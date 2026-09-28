/** ApprovalMatrixBuilder/constants.js */
import { Shield, Users as UsersIcon, User } from "lucide-react";

const MODE_META = {
  permission: { icon: Shield, label: "Permission", color: "#3b82f6" },
  role: { icon: UsersIcon, label: "Role", color: "#a855f7" },
  user: { icon: User, label: "User Spesifik", color: "#f59e0b" },
};

function emptyStep() {
  return {
    label: "",
    match_mode: "permission",
    any_of_perms: [],
    any_of_role_ids: [],
    any_of_user_ids: [],
    deadline_hours: null,
  };
}
function emptyTier() {
  return {
    label: "",
    min_amount: 0,
    max_amount: null,
    condition_outlet_ids: [],
    condition_brand_ids: [],
    steps: [emptyStep()],
  };
}


export { MODE_META, emptyStep, emptyTier };
