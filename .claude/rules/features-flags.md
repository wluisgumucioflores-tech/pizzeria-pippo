# Feature Configuration Rule

Whenever a new feature is proposed, designed, or implemented, always evaluate whether the feature should be configurable by the business.

Before implementing the feature, ask:

> Should this feature be configurable by the business through a feature flag or business configuration?

Consider:
- Whether the business may want to enable or disable the feature.
- Whether different branches, stores, tenants, or customers may need different behavior.
- Whether the feature may need to be enabled gradually.
- Whether the business may want to change the behavior without deploying a new version.
- Whether the feature is expected to evolve into a business-controlled setting.

If the answer is YES:
- Propose the appropriate configuration or feature flag.
- Define its scope (global, tenant, branch, user, etc.).
- Define the default value.
- Explain where the configuration should be managed.
- Do not hardcode the behavior.

If the answer is NO:
- Explain briefly why a business configuration is not necessary.
- Proceed with a normal implementation.

This evaluation must happen before implementing every new feature.