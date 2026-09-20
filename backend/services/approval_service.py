"""Public facade for the approval engine.

The implementation has been split into the private `services._approval`
package to keep individual files under 500 lines. All existing imports
remain identical — e.g.

    from services import approval_service
    await approval_service.approve(...)

still works exactly the same.

Note: This file MUST stay a thin re-export of the API contract; any logic
should live in services/_approval/*.
"""
from services._approval import (  # noqa: F401
    # constants
    ENTITY_COLLECTIONS,
    ENTITY_STATUS_FIELD,
    ENTITY_LABELS,
    ENTITY_LINK_BUILDERS,
    DEFAULT_WORKFLOWS,
    # delegations
    create_delegation,
    list_delegations,
    revoke_delegation,
    _check_delegation,
    # workflow
    get_workflow,
    list_workflows,
    create_workflow,
    update_workflow,
    delete_workflow,
    seed_defaults,
    # evaluator
    compute_amount,
    evaluate,
    # permissions
    _user_has_any_perm,
    _user_matches_step,
    # notifications
    notify_pending_approvers,
    notify_creator,
    _resolve_eligible_approvers,
    _push_approval_notif,
    _entity_label,
    _entity_link,
    _doc_descriptor,
    # runtime
    approve,
    reject,
    _collection_for,
    _get_entity,
    # escalation
    check_and_escalate,
)
