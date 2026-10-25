# Feature register

The [complete checklist](implementation-checklist.md) and [machine-readable register](feature-register.json) contain 430 individual requirements. Keep requirement IDs stable. Each JSON entry includes implementation files and verification evidence. Checkboxes track implemented behavior; family-level checks do not certify every individual requirement. External configuration and outstanding acceptance checks are explicit. See [verification.md](verification.md).

## Fixed product decisions

One shared workspace with no login or permissions; stable person IDs and optional ownership; per-person plans, notes, availability, essentials and timers; shared task status. List, Board and Timeline use the same records. Status changes do not move dates.

Travel applies to away tasks/groups; weather also applies at home outdoors. Google supplies maps, places, routes and opening hours; Open-Meteo supplies weather. Feedback is advisory. No automatic rescheduling or route optimization.

## Exclusions

No command menu, dedicated quick actions, custom keyboard shortcuts, accounts/permissions, custom board workflows, dedicated weekly review, goals/milestones, multiple scheduled work sessions per task, weekly habit targets, general task backlinks, notes-to-task conversion, completion measurements, automation rules, revisit dates, contingency plans, automatic replanning, ready-to-start recommendations, project-review cadence, flexible scheduling windows, or product-level demo reset. Ordinary keyboard accessibility and deliberate CLI demo seeding remain required.
