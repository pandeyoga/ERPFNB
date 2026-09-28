"""Public facade for business_rules_service.

The implementation has been split into the private `services._business_rules`
package to keep individual files under ~300 lines. All existing imports remain
identical — e.g.

    from services import business_rules_service as svc
    rule = await svc.resolve_rule(rule_type=..., outlet_id=...)
"""
from services._business_rules import (  # noqa: F401
    # Constants
    SUPPORTED_RULE_TYPES,
    RULE_TYPE_LABELS,
    VALID_SCOPE_TYPES,
    DEFAULT_RULES,
    # Overlap detection
    detect_overlaps,
    # Read / list / timeline / resolve
    list_rules,
    get_rule,
    get_active_rule,
    resolve_rule,
    get_timeline,
    # CRUD / lifecycle
    create_rule,
    update_rule,
    duplicate_rule,
    archive_rule,
    activate_rule,
    delete_rule,
    # Seeds
    seed_defaults,
)
