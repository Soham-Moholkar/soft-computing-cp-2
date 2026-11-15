"""Public HTTPS fetching with DNS pinned to the validated address."""
import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urljoin, urlsplit

from app.core.errors import IngestionError
from app.ingestion.parser import MAX_BYTES


def public_target(url: str) -> tuple[str, str, str]:
    parts = urlsplit(url)
    try:
        port = parts.port
    except ValueError as error:
        raise IngestionError("Invalid URL port.") from error
    if parts.scheme != "https" or not parts.hostname or parts.username or parts.password or port not in {None, 443}:
        raise IngestionError("URL sources must use public HTTPS on port 443 without credentials.")
    host = parts.hostname.encode("idna").decode("ascii")
    if host == "localhost" or host.endswith((".localhost", ".local", ".internal")):
        raise IngestionError("Private network URL sources are not allowed.")
    try:
        addresses = sorted({entry[4][0] for entry in socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)})
    except OSError as error:
        raise IngestionError("The source hostname could not be resolved.") from error
    if not addresses or any(not ipaddress.ip_address(address).is_global for address in addresses):
        raise IngestionError("Private network URL sources are not allowed.")
    path = parts.path or "/"
    if parts.query:
        path += "?" + parts.query
    return host, addresses[0], path


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, host: str, address: str) -> None:
        super().__init__(host, port=443, timeout=10, context=ssl.create_default_context())
        self.address = address

    def connect(self) -> None:
        raw_socket = socket.create_connection((self.address, 443), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw_socket, server_hostname=self.host)
        except Exception:
            raw_socket.close()
            raise


def fetch_url(url: str) -> tuple[bytes, str, str]:
    for _ in range(4):
        host, address, path = public_target(url)
        connection = PinnedHTTPSConnection(host, address)
        try:
            connection.request("GET", path, headers={"User-Agent": "SoftGraph/0.1", "Accept": "text/html,text/plain,application/pdf,text/csv,application/json", "Accept-Encoding": "identity"})
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location:
                    raise IngestionError("The URL returned a redirect without a destination.")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise IngestionError(f"The source returned HTTP {response.status}.")
            if response.getheader("Content-Encoding", "identity") != "identity":
                raise IngestionError("Compressed URL responses are not supported.")
            media_type = response.getheader("Content-Type", "").split(";", 1)[0].strip().lower()
            kinds = {"text/html": "html", "text/plain": "txt", "text/csv": "csv", "application/json": "json", "application/pdf": "pdf"}
            if media_type not in kinds:
                raise IngestionError("URL must return HTML, plain text, PDF, CSV or JSON.")
            content = response.read(MAX_BYTES + 1)
            if len(content) > MAX_BYTES:
                raise IngestionError("URL source exceeds the 10 MiB limit.")
            return content, kinds[media_type], url
        except IngestionError:
            raise
        except (OSError, http.client.HTTPException) as error:
            raise IngestionError("The source could not be fetched within the network timeout.") from error
        finally:
            connection.close()
    raise IngestionError("The URL exceeded the redirect limit.")
