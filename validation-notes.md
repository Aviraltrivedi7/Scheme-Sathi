# Current Validation Notes

- 2026-08-20: The `/admin/pilot` development route rendered at desktop width with the Hindi PDF action, folder filter, folder draft field, private saved-view controls, and cohort-report controls visible together without overlap.
- 2026-08-20: The same route rendered at a 375px mobile width. The saved-view controls stacked into one column, and the report actions remained visible and reachable without horizontal clipping.
- The captured administrator screen contained no submitted cohort or dashboard-view records, so the private drag list did not appear in the empty-state visual capture. Its rendering and interaction contract are covered by source-level regression tests.
- 2026-08-20: The desktop `/admin/pilot` render showed the Hindi PDF header/footer input row and the compact Alt-based saved-view shortcut guide without colliding with report actions or saved-view controls.
- 2026-08-20: At 375px, the new print-branding inputs and saved-view shortcut guide stacked cleanly above the saved-view editor. The empty development account again meant folder rename and bulk-move panels had no visible data rows; their protected API and UI contracts are covered by regression tests.
