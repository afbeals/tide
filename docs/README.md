# Tide documentation

Current local verification: 130 core tests, 149 Storybook interaction/accessibility stories, 27 production browser tests and 20 visual comparisons. Live Google configuration and Docker/Unraid checks remain external. See the [verification record](verification.md) for evidence and acceptance limits.

Start with [setup](setup.md) for a new machine, [demo](demo.md) for a walkthrough, or [Unraid deployment](deploy-unraid.md) for hosting.

| Document | Purpose |
|---|---|
| [setup.md](setup.md) | Setup |
| [development.md](development.md) | Development |
| [architecture.md](architecture.md) | Architecture |
| [database.md](database.md) | Database |
| [api.md](api.md) | Api |
| [state.md](state.md) | State |
| [workspace.md](workspace.md) | Workspace |
| [planning-workflow.md](planning-workflow.md) | Planning workflow |
| [styling.md](styling.md) | Styling |
| [integrations.md](integrations.md) | Google account, billing, API keys, local/Unraid setup, weather and troubleshooting |
| [testing.md](testing.md) | Coverage, Storybook, accessibility, visual regression, production tests and CI |
| [deploy-unraid.md](deploy-unraid.md) | Deploy unraid |
| [backup-restore.md](backup-restore.md) | Backup restore |
| [demo.md](demo.md) | Demo |
| [verification.md](verification.md) | Verification |
| [feature-register.md](feature-register.md) | Accepted scope and exclusions |
| [implementation-checklist.md](implementation-checklist.md) | Individual build/acceptance requirements |
| [figma-reference-register.md](figma-reference-register.md) | Exact screen/state references |
| [original-design-brief.md](original-design-brief.md) | Historical design brief; later shared-workspace decisions override single-person assumptions |

Machine-readable records: [feature-register.json](feature-register.json) and [figma-inventory.json](figma-inventory.json). Documentation follows Finapp’s organization but describes Tide’s actual stack and workflows.

Use the [screen-to-implementation map](screen-build-map.md) to find the code and entry point for each of the 836 Figma sources.
