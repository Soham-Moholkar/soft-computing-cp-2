import { policies, type Policy } from './catalog';
import { expandedPolicies } from './expansion';
import { mobilityPolicies } from './mobility';
import { welfarePolicies } from './welfare';
import directoryData from './directory-data.json';
import { directoryProfile } from './directory-evidence';

const detailed = [
  ...policies,
  ...expandedPolicies,
  ...mobilityPolicies,
  ...welfarePolicies,
];
const knownUrls = new Set(
  detailed.flatMap((policy) =>
    policy.versions.map((version) => version.source.url),
  ),
);
const directory: Policy[] = directoryData
  .filter((item) => !knownUrls.has(item.url))
  .map((item, index) => {
    const profile = directoryProfile(item);
    return {
      id: `listing-${index + 1}`,
      name: item.name,
      topic: item.topic === 'Education' ? 'Education' : 'Small business',
      ...(item.state ? { state: item.state } : {}),
      ...(item.topic === 'Education'
        ? { fundingType: 'Scholarship' as const }
        : {}),
      listingOnly: !profile,
      keywords: item.name,
      versions: profile
        ? [profile]
        : [
            {
              id: 'listing',
              label: 'Official directory entry',
              years: [],
              source: {
                title: item.sourceTitle,
                locator: item.locator,
                url: item.url,
              },
              summary:
                'This programme appears in the official directory. Open the listed source for programme details, funding, dates and application instructions.',
              rules: [
                {
                  label: 'Official listing',
                  verb: 'is listed in',
                  target: item.sourceTitle,
                  kind: 'Rule' as const,
                  keywords: item.name,
                  evidence: `The official source lists “${item.name}”.`,
                },
              ],
            },
          ],
    };
  });
export const policyIndex = [...detailed, ...directory];
export const detailedCount = policyIndex.filter(
  (policy) => !policy.listingOnly,
).length;
export const fullGraphCount = policyIndex.filter((policy) =>
  policy.versions.some((version) =>
    ['eligibility', 'funding', 'documents'].every((layer) =>
      version.rules.some((rule) => rule.layer === layer),
    ),
  ),
).length;
