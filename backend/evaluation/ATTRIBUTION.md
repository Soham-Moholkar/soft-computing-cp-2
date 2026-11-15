# SQuAD data attribution

The real-data adaptation uses the official public SQuAD 2.0 development dataset.
Original dataset: [Stanford Question Answering Dataset](https://rajpurkar.github.io/SQuAD-explorer/).
SQuAD 2.0 authors: Pranav Rajpurkar, Robin Jia and Percy Liang; source passages and Wikipedia contributor attribution originate with the upstream dataset.

Dataset and this normalized/context-retrieval adaptation: [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Retain attribution and share-alike terms when redistributing the dataset adaptation. This notice describes the data, not a new license for the project code.

Upstream bytes: [dev-v2.0.json](https://rajpurkar.github.io/SQuAD-explorer/dataset/dev-v2.0.json).
Raw SHA-256: `80a5225e94905956a6446d296ca1093975c4d3b3260f1d6c8f68bc2ab77182d8`.

Changes: seeded article-family reassignment into local train/validation/test partitions; selection of up to six normalized paragraphs per article and two answerable questions per paragraph; conversion from answer spans to paragraph-retrieval judgments. Original QA IDs are retained. This is not an official SQuAD evaluation or an independently reviewed course benchmark. Passage-scoped unanswerable annotations are excluded because they do not establish corpus-wide unanswerability.

Article families (Wikipedia contributors; consult article history for attribution):

- [1973_oil_crisis](https://en.wikipedia.org/wiki/1973_oil_crisis)
- [Amazon_rainforest](https://en.wikipedia.org/wiki/Amazon_rainforest)
- [Black_Death](https://en.wikipedia.org/wiki/Black_Death)
- [Civil_disobedience](https://en.wikipedia.org/wiki/Civil_disobedience)
- [Construction](https://en.wikipedia.org/wiki/Construction)
- [Ctenophora](https://en.wikipedia.org/wiki/Ctenophora)
- [Economic_inequality](https://en.wikipedia.org/wiki/Economic_inequality)
- [European_Union_law](https://en.wikipedia.org/wiki/European_Union_law)
- [French_and_Indian_War](https://en.wikipedia.org/wiki/French_and_Indian_War)
- [Geology](https://en.wikipedia.org/wiki/Geology)
- [Harvard_University](https://en.wikipedia.org/wiki/Harvard_University)
- [Huguenot](https://en.wikipedia.org/wiki/Huguenot)
- [Immune_system](https://en.wikipedia.org/wiki/Immune_system)
- [Imperialism](https://en.wikipedia.org/wiki/Imperialism)
- [Islamism](https://en.wikipedia.org/wiki/Islamism)
- [Jacksonville,_Florida](https://en.wikipedia.org/wiki/Jacksonville%2C_Florida)
- [Normans](https://en.wikipedia.org/wiki/Normans)
- [Oxygen](https://en.wikipedia.org/wiki/Oxygen)
- [Packet_switching](https://en.wikipedia.org/wiki/Packet_switching)
- [Pharmacy](https://en.wikipedia.org/wiki/Pharmacy)
- [Prime_number](https://en.wikipedia.org/wiki/Prime_number)
- [Private_school](https://en.wikipedia.org/wiki/Private_school)
- [Rhine](https://en.wikipedia.org/wiki/Rhine)
- [Scottish_Parliament](https://en.wikipedia.org/wiki/Scottish_Parliament)
- [Sky_(United_Kingdom)](https://en.wikipedia.org/wiki/Sky_%28United_Kingdom%29)
- [Southern_California](https://en.wikipedia.org/wiki/Southern_California)
- [Steam_engine](https://en.wikipedia.org/wiki/Steam_engine)
- [Victoria_(Australia)](https://en.wikipedia.org/wiki/Victoria_%28Australia%29)
- [Warsaw](https://en.wikipedia.org/wiki/Warsaw)
- [Yuan_dynasty](https://en.wikipedia.org/wiki/Yuan_dynasty)
