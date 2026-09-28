"""Private impl of approval engine — split from former approval_service.py.

Public API exported from this package is re-exported by
`services.approval_service` (the thin facade). Code in the rest of the
codebase should import from `services.approval_service`, not from here.
"""
# Re-export the public API
from services._approval.constants import (  # noqa: F401
    ENTITY_COLLECTIONS,
    ENTITY_STATUS_FIELD,
    ENTITY_LABELS,
    ENTITY_LINK_BUILDERS,
    DEFAULT_WORKFLOWS,
)
from services._approval.delegations import (  # noqa: F401
    create_delegation,
    list_delegations,
    revoke_delegation,
    _check_delegation,
)
from services._approval.workflow import (  # noqa: F401
    get_workflow,
    list_workflows,
    create_workflow,
    update_workflow,
    delete_workflow,
    seed_defaults,
)
from services._approval.evaluator import (  # noqa: F401
    compute_amount,
    evaluate,
)
from services._approval.permissions import (  # noqa: F401
    _user_has_any_perm,
    _user_matches_step,
)
from services._approval.notifications import (  # noqa: F401
    notify_pending_approvers,
    notify_creator,
    _resolve_eligible_approvers,
    _push_approval_notif,
    _entity_label,
    _entity_link,
    _doc_descriptor,
)
from services._approval.runtime import (  # noqa: F401
    approve,
    reject,
    _collection_for,
    _get_entity,
)
from services._approval.escalation import (  # noqa: F401
    check_and_escalate,
)
