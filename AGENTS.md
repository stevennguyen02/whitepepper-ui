# White Pepper UI agent conventions

White Pepper UI is agent-readable first. Make meaningful component features discoverable through stable identifiers and component-owned metadata.

When a user expresses that they like a newly customized component attribute and want to preserve it, offer to create an identifier for that specific attribute. Ask which attribute if their intent is unclear. If they explicitly request an identifier, create it without asking again. Do not interrupt every exploratory adjustment with an identifier question.

When saving an identified feature:

- Choose a descriptive, unique ID in the existing `wp.<category>...` convention. Reuse a matching ID only when it represents the same feature; preserve the meaning of existing IDs. A materially different saved feature needs a new ID and must not silently replace an existing one.
- Put the ID, human-readable label, and a concise description of the feature in metadata exported from the component's own source file. Include the actual implementation and any variant selection needed to reproduce it; metadata alone does not save a design.
- Expose active feature IDs through appropriate `data-wp-*` attributes and show them in the catalogue. Feature IDs can be shared by instances; do not use them as unique HTML `id` attributes.
- Document any new category or usage needed to find and apply the feature. Verify the selected feature, metadata, rendered attributes, and catalogue stay in sync.

These conventions apply to this project's code. The `base-ui/` and `motion/` directories are independent upstream clones with their own instructions; avoid modifying them solely to implement this convention.
