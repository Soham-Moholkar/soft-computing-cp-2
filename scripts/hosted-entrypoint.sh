#!/bin/sh
set -eu

# The mounted volume may initially be owned by root.
install -d -m 0700 -o softgraph -g softgraph /var/data/softgraph
exec gosu softgraph python scripts/start-hosted.py
