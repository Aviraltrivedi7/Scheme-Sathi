# Development Validation Notes

## Cohort conversion and scholarship navigation — 19 August 2026

The first desktop visual capture confirmed that the expanded Discover filter stack is present with **Scheme level**, **Provider area**, **Source status**, deadline, and sorting controls. The capture occurred before the client query cycle completed, so it displayed the intended loading state with a zero-count placeholder rather than rendered catalog rows. The authenticated `/admin/pilot` capture did not complete its page body in the same initial capture window.

The warm Discover recheck completed successfully. It rendered **42** catalog records and populated the Provider area menu from the catalog, including the scholarship providers. The page also rendered the source-status labels on records and showed the new provider-area sort option. The admin conversion screen still needs a warm authenticated visual recheck before the feature checkpoint.

The sandbox browser correctly stopped at the existing **Sign in to continue** boundary for `/admin/pilot`; no account login was performed for visual inspection. The admin funnel is nevertheless covered by protected router tests, and the page compiles in the production build. The mobile Discover recheck rendered the complete new filter stack and all result cards without a runtime error. It preserves the existing single-column mobile discovery flow, with controls preceding the results.

## Hindi discovery and cohort reporting — 19 August 2026

The warm Discover recheck rendered the Hindi-first scholarship discovery screen and all **42** catalog records. Provider-area filter options, category/filter labels, source-status labels, scholarship cards, and official actions display Hindi labels while retaining the canonical English values for server filtering. The visible language control restores the English interface on demand. The administrator report screen remains behind the existing sign-in boundary in the sandbox browser, so its aggregate date-range query and CSV export are validated through protected router contracts and focused export tests rather than a real administrator login.

## Hindi state names and monthly cohort trend — 19 August 2026

The settled Discover browser render showed all currently offered state choices in Hindi, including **आंध्र प्रदेश**, **बिहार**, **दिल्ली**, **मध्य प्रदेश**, **महाराष्ट्र**, **तमिलनाडु**, **उत्तर प्रदेश**, and **पश्चिम बंगाल**, while returning the seeded 42-record catalog. The protected administrator chart cannot be rendered without an administrator session in the sandbox; its aggregate-only monthly query, date-range validation, no-visit handling, chart binding, and responsive CSS are covered by server and UI-contract tests. The CSV summary row is validated through its browser-local export helper and includes recalculated totals/rates rather than summing per-cohort rounded rates.

The completed non-visual checks at this point are the focused cohort/catalog tests, the full 88-test suite, TypeScript validation, and the production build.
