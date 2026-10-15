# Knowledge-base maintenance

English | [简体中文](../../Cns/docs/知识库维护.md)

The knowledge base is maintained with the engine. Product documents explain goals and reasoning; contracts define behavior; registries track decisions and delivery; verification records describe reproducible observations. [The reading index](../README.md) and [current version](../current-version.json) provide entry points.

## Update order

1. Record the source, date, version and evidence scope. Separate observations from hypotheses.
2. Connect affected requirements, decisions, implementation and acceptance records using their stable IDs.
3. Update the relevant explanatory documents in both languages, including the reason for a changed design. Keep the main narrative focused on the current coherent design.
4. Refresh current document identities and English registry views. Validate links and shared status, then review technical meaning and translation.

Run the structural checker from the knowledge-base root:

    pwsh -NoProfile -File tools/Validate-KnowledgeBase.ps1 -CheckOnly

Relative links in knowledge-base documents stay within the `knowledge-base` tree. Refer to repository-root policies, contribution guides and acknowledgements through their canonical GitHub URLs.

## Responsibilities and cadence

Maintainers review scope and integration; domain reviewers check contracts and evidence; contributors keep sources and examples reproducible. Publish role assignments through community governance. Update records when evidence, design or delivery changes, and periodically check broken sources and unresolved work.

## Maintaining open-source references

Record the consulted version or commit, relevant mechanism, license and actual use. Research references, product dependencies and integration experiments serve different roles. Keep citations beside the conclusions they support and collect credits in [Acknowledgements](https://github.com/cnedwin/Egret_rebuild/blob/main/ACKNOWLEDGEMENTS.md). A reference implementation informs analysis; Egret's own contract and tests determine its behavior.

## Maintaining implementation sources

Follow the [implementation and dependency policy](independent-implementation-and-dependency-policy.md). Describe the materials used, first-party scope, dependencies, AI assistance and review in the [origin record](../templates/implementation-origin-record.md). Record upgrades and affected verification.

## Public copies and historical evidence

Write design documents in neutral project language. Explain the problem, constraints, alternatives and chosen approach without reproducing conversations or respondent roles. Material technical changes belong in a decision or dated verification record; routine drafting history stays in version control. Do not attribute unrecorded thoughts or conclusions to an individual.

Reading documents can be reorganized as the product matures. Preserve source attribution, numerical results, uncertainty, original evidence and the scope of earlier reviews. Historical hashes continue to identify historical files; current text has its own identity. Update both editions together so they remain one product plan.
