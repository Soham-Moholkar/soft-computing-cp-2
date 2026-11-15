# Course annotation guidelines, version 1

The starter collection is original synthetic text with **provisional, unreviewed**
labels. It includes affirmative relations, negation, aliases, multi-hop questions,
ambiguous queries, unsupported facts and out-of-ontology concepts. Labels are
written from the source meaning, never copied from extractor output.

1. Record a stable source ID, source-family ID, split and permission/license note.
   Keep all revisions and paraphrases of a source in one family and partition.
   For real sources record bibliographic provenance and rights separately; a
   nonempty license field alone is not proof of permission.
2. Mark every concept mention with exact zero-based `[start, end)` character
   offsets in the supplied normalized text. Keep repeated mentions. Use the
   canonical course name for aliases such as PSO. Include meaningful concepts
   outside the fixed ontology to measure coverage gaps. Do not label generic
   uses of words such as "extraction" as a named course entity automatically.
3. Label directed source/predicate/target relation triples only when the text
   explicitly asserts the relation. Normalize inflections to the backend's
   predicate vocabulary, such as `uses`, `supports`, `improves`, `tunes`,
   `explores`, `creates`, `includes`. Repeated identical triples within a source
   count once. Negation, uncertain suggestions and co-occurrence do not assert a
   positive relation. All endpoints must have a gold mention.
4. Write natural questions separately from source wording. Include aliases,
   multi-hop requests, ambiguous requests and no-answer questions. A question
   is answerable only when that partition's sources provide the requested fact;
   outside world knowledge does not count. A negation question can be answerable
   from a negated source even though the positive graph edge should be absent.
5. For answerable questions, list **all** relevant source excerpts. Grade 2 means
   directly relevant evidence; grade 1 means useful context that alone does not
   settle the request. Excerpts must be exact substrings. No-answer queries have
   no judgments. Review every source for unlisted relevant evidence. An ambiguous
   concept query may legitimately have several relevant passages.
6. Two independent reviewers should label real evaluation material. Record their
   original labels, disagreements, adjudicator and resolution in an accompanying
   audit file. Only then set `review_status` to `human_reviewed` and name reviewers.
   Never infer review or permission from passing schema validation.
7. Freeze train/validation/test sources before development, record dataset hashes,
   and do not inspect test metrics until final comparison. The current JSON gate
   is procedural. Near-duplicate and semantic leakage require manual inspection.

Current limitations: relation matching is document-level, without relation-span
scoring; evidence matching uses exact excerpts and rejects an excerpt crossing a
chunk boundary; short synthetic sources are not representative of real course
documents. Expand annotation/schema coverage before evaluating long documents or
claiming source entailment or scientific quality.

## Adapted human data and family dependence

SQuAD answer spans identify paragraphs in a retrieval-only adaptation, not
course entities/relations or corpus-wide no-answer gold. Mark the domain and
`annotation_tasks` explicitly, preserve attribution and upstream QA IDs, and
keep `adaptation_reviewed: false` until independent pooled relevance review.
Article variants share a family. Query-family IDs must respect the source split;
multi-source questions connect their families for bootstrap resampling. Label
independent no-answer families explicitly when justified; arbitrary unique IDs
must not manufacture statistical independence. Review shared cross-split facts
and semantic paraphrases even when lexical near-duplicate tests pass.
