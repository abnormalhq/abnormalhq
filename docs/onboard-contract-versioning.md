# Storefront contract source and compatibility

This public repository is the canonical source of `docs/onboard-contract.json` and `scripts/contract-compat.ts`. The private mail repository pins both to an immutable commit of this repository. Its CI checks the provider against that published snapshot and the current public storefront contract. This works without sharing credentials for the private mail repository.

The storefront lock pins the previously published baseline. CI verifies its checksum and requires the current contract to preserve it. Keep the existing fixture tests: they connect each application's actual constants and routes to the contract; the new gate connects the repositories.

To extend the API, publish a compatible contract change here first, then implement the provider and advance its pin. Additive response fields and routes are permitted. New enums, removed fields, changed validation and request-field changes fail the gate. These checks are intentionally conservative and do not prove runtime behavior.

For breaking changes, introduce a versioned endpoint alongside the existing route, migrate callers, and retain the old route until its consumers have been retired. A version-number bump alone never permits removal. Advancing a baseline is an explicit compatibility decision requiring review of the retiring consumers; do not update the lock just to silence a failure. Offline fixture tests cover extension, migration, removal and tampered snapshots. CI fails closed if it cannot fetch the published source.
