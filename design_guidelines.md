{
  "meta": {
    "product": "Torado ERP",
    "goal": "Compact-density + information-architecture redesign blueprint (theme preserved)",
    "non_negotiables": [
      "DO NOT change visual theme, brand, color palette, or font family (Inter).",
      "Keep aurora/glassmorphism tokens and --radius: 0.875rem.",
      "Light + dark modes already implemented; do not re-theme.",
      "Optimize for 15-inch laptop logical viewport ~1280x720–800.",
      "All interactive + key informational elements MUST include data-testid (kebab-case, role-based).",
      "React + Tailwind + shadcn/ui (.jsx files)."
    ]
  },

  "design_personality": {
    "keywords": [
      "dense",
      "scan-first",
      "predictable",
      "enterprise",
      "glass + aurora accents",
      "low-chrome, high-data"
    ],
    "north_star": "More relevant information above-the-fold with fewer clicks and less scrolling, without sacrificing clarity or a11y."
  },

  "typography_scale": {
    "notes": [
      "Keep Inter everywhere. Do not introduce new font families.",
      "Dense ERP: reduce oversized headings; use weight/color/spacing for hierarchy.",
      "Use tabular numbers for KPIs and tables: `tabular-nums` + `tracking-tight` for large numbers.",
      "Prefer sentence case for nav + tabs; reserve uppercase for micro-labels only."
    ],
    "tokens": {
      "display": {
        "use": "Rare (landing-like hero only). Avoid in ERP pages.",
        "class": "text-3xl md:text-4xl font-semibold leading-[1.15] tracking-[-0.02em]"
      },
      "h1": {
        "use": "Page title",
        "class": "text-xl md:text-2xl font-semibold leading-[1.2] tracking-[-0.015em]"
      },
      "h2": {
        "use": "Section title / panel title",
        "class": "text-base md:text-lg font-semibold leading-[1.25] tracking-[-0.01em]"
      },
      "h3": {
        "use": "Card title / sub-section",
        "class": "text-sm md:text-base font-semibold leading-[1.3]"
      },
      "body": {
        "use": "Default reading",
        "class": "text-sm md:text-[0.9375rem] leading-[1.45]"
      },
      "label": {
        "use": "Form labels, table headers",
        "class": "text-xs md:text-sm font-medium leading-[1.2] text-muted-foreground"
      },
      "caption": {
        "use": "Helper text, meta",
        "class": "text-xs leading-[1.2] text-muted-foreground"
      },
      "micro_upper": {
        "use": "KPI micro-labels, chip labels",
        "class": "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
      },
      "data_number_lg": {
        "use": "KPI value in compact stat card",
        "class": "text-lg md:text-xl font-semibold leading-[1.1] tabular-nums tracking-[-0.02em]"
      },
      "data_number_md": {
        "use": "Inline metrics, table totals",
        "class": "text-sm md:text-base font-semibold leading-[1.1] tabular-nums"
      },
      "table_cell": {
        "use": "Dense table cell",
        "class": "text-xs md:text-sm leading-[1.25]"
      }
    },
    "page_header_changes": {
      "current_issue": "PageHeader uses h1 text-3xl + large icon + mb-6; wastes vertical space.",
      "target": {
        "title_class": "text-xl md:text-2xl font-semibold leading-[1.2]",
        "subtitle_class": "text-xs md:text-sm text-muted-foreground leading-[1.3]",
        "icon_class": "h-6 w-6 md:h-7 md:w-7",
        "container_spacing": "mb-3 md:mb-4"
      }
    }
  },

  "spacing_density_scale": {
    "principles": [
      "Adopt a strict 4px grid (Tailwind spacing already maps well).",
      "Reduce vertical padding first; keep horizontal padding comfortable for scanability.",
      "Prefer `gap-*` over ad-hoc margins; standardize per archetype."
    ],
    "tokens": {
      "page_padding": {
        "default": "px-3 sm:px-4 lg:px-5",
        "vertical": "py-3 lg:py-4",
        "note": "Replace current lg:py-8 with lg:py-4 for ERP pages."
      },
      "section_gap": {
        "stack": "space-y-3 lg:space-y-4",
        "grid_gap": "gap-3 lg:gap-4"
      },
      "card_padding": {
        "compact": "p-3",
        "default": "p-4",
        "dense_table_wrapper": "p-2 sm:p-3"
      },
      "card_header_padding": "px-3 pt-3 pb-2",
      "card_footer_padding": "px-3 pt-2 pb-3",
      "input_height": {
        "sm": "h-8",
        "md": "h-9"
      },
      "button_height": {
        "sm": "h-8",
        "md": "h-9"
      },
      "table": {
        "row_height": "h-9 (default), h-8 (dense mode)",
        "cell_padding": "py-2 px-2.5 (default), py-1.5 px-2 (dense)",
        "header_padding": "py-2 px-2.5"
      },
      "tabs": {
        "pill_height": "h-8",
        "pill_padding": "px-2.5",
        "pill_gap": "gap-1.5"
      },
      "kpi_strip": {
        "target_height": "~44–52px",
        "reference": "Existing KpiSnapshotStrip is already compact; use it as baseline."
      }
    }
  },

  "component_sizing_specs": {
    "unify_stat_card": {
      "goal": "Replace 5 inconsistent KPI/stat card variants with one unified CompactStatCard (sm/md).",
      "target_heights": {
        "sm": "~72px",
        "md": "~88px"
      },
      "layout": [
        "Left: label + value stacked",
        "Right: icon in a subtle glass badge OR delta chip",
        "Avoid empty right whitespace: use `justify-between` + fixed icon container"
      ],
      "classes": {
        "wrapper": "glass-card p-3 flex items-center justify-between gap-3",
        "left": "min-w-0 flex-1",
        "label": "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground truncate",
        "value": "text-lg md:text-xl font-semibold leading-[1.1] tabular-nums tracking-[-0.02em]",
        "meta": "mt-0.5 text-xs text-muted-foreground truncate",
        "iconWrap": "shrink-0 h-9 w-9 rounded-[calc(var(--radius)-2px)] glass-panel flex items-center justify-center",
        "icon": "h-4.5 w-4.5"
      },
      "variants": {
        "sm": {
          "wrapper": "min-h-[72px]",
          "value": "text-lg"
        },
        "md": {
          "wrapper": "min-h-[88px]",
          "value": "text-xl"
        }
      },
      "data_testids": {
        "card": "kpi-card",
        "label": "kpi-card-label",
        "value": "kpi-card-value",
        "delta": "kpi-card-delta"
      }
    },

    "sidebar_compact": {
      "goals": [
        "Usable without collapsing.",
        "Fix double-active bug (parent + child both highlighted).",
        "Reduce font size + padding; increase scanability with section labels."
      ],
      "dimensions": {
        "width": "w-[248px] (target), max w-[260px]",
        "current": "w-[280px] (too wide for 1280px)"
      },
      "typography": {
        "section_label": "text-[11px] uppercase tracking-[0.08em] text-muted-foreground",
        "item": "text-[13px] leading-[1.2]",
        "subitem": "text-[12.5px] leading-[1.2]"
      },
      "spacing": {
        "section_padding": "px-2.5 pt-3 pb-1",
        "item_padding": "px-2.5 py-1.5",
        "subitem_padding": "pl-8 pr-2.5 py-1.25",
        "item_gap": "gap-1"
      },
      "active_state_model": {
        "rule": "Only ONE element is visually active: the deepest matched route.",
        "parent_behavior": "If a child route is active, parent shows a subtle indicator (e.g., left border or dot) but NOT the same active background.",
        "implementation_hint": "Use NavLink `isActive` only for exact match on leaf items; for parents use `isChildActive` to set `aria-expanded=true` and a minimal style (no bg)."
      },
      "classes": {
        "item_base": "flex items-center gap-2 rounded-[calc(var(--radius)-4px)]",
        "item_idle": "text-foreground/80 hover:text-foreground hover:bg-white/35 dark:hover:bg-white/5",
        "item_active_leaf": "pill-active",
        "item_active_parent": "text-foreground font-medium",
        "focus": "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      },
      "data_testids": {
        "sidebar": "app-sidebar",
        "portal_switcher": "sidebar-portal-switcher",
        "nav_item": "sidebar-nav-item",
        "nav_section": "sidebar-nav-section"
      }
    },

    "search_bars": {
      "global_search": {
        "pattern": "Command palette (shadcn Command) triggered by Ctrl/⌘K; also a small search input in header for discoverability.",
        "classes": {
          "trigger": "h-8 px-2.5 text-xs md:text-sm glass-input rounded-[calc(var(--radius)-4px)]",
          "input": "h-9 glass-input"
        },
        "components": [
          "/app/frontend/src/components/ui/command.jsx",
          "/app/frontend/src/components/ui/dialog.jsx",
          "/app/frontend/src/components/ui/input.jsx"
        ],
        "data_testids": {
          "open": "global-search-open",
          "input": "global-search-input",
          "result": "global-search-result"
        }
      },
      "table_search": {
        "pattern": "Inline search in table toolbar; debounce 250ms; show active filter chips.",
        "classes": {
          "input": "h-8 w-[220px] md:w-[260px] glass-input text-sm",
          "chip": "h-6 px-2 text-xs"
        },
        "data_testids": {
          "input": "table-search-input",
          "clear": "table-search-clear"
        }
      }
    },

    "buttons": {
      "density": "Use shadcn Button with compact heights; avoid oversized CTAs in ERP.",
      "classes": {
        "primary": "h-8 md:h-9 px-3 md:px-3.5 text-sm",
        "secondary": "h-8 md:h-9 px-3 text-sm",
        "ghost": "h-8 px-2.5 text-sm"
      },
      "data_testids": {
        "primary": "primary-action-button",
        "secondary": "secondary-action-button"
      },
      "components": ["/app/frontend/src/components/ui/button.jsx"]
    },

    "tabs_unification": {
      "goal": "Reduce 4 inconsistent tab styles to ONE: compact pill tabs (PortalSubNav style).",
      "classes": {
        "list": "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-2px)] bg-white/35 dark:bg-white/5 p-1",
        "trigger": "h-8 px-2.5 text-[13px] rounded-[calc(var(--radius)-4px)] data-[state=active]:pill-active",
        "content": "mt-3"
      },
      "components": ["/app/frontend/src/components/ui/tabs.jsx"],
      "data_testids": {
        "tabs": "page-tabs",
        "tab": "page-tab-trigger"
      }
    },

    "tables": {
      "goal": "Dense tables with predictable toolbars, sticky headers, and inline row actions.",
      "classes": {
        "wrapper": "glass-card p-2 sm:p-3",
        "toolbar": "flex flex-wrap items-center justify-between gap-2 pb-2",
        "table": "w-full",
        "thead": "sticky top-0 bg-white/55 dark:bg-black/20 backdrop-blur",
        "th": "text-xs font-medium text-muted-foreground py-2 px-2.5",
        "td": "text-xs md:text-sm py-1.5 px-2.5",
        "row": "hover:bg-white/35 dark:hover:bg-white/5"
      },
      "row_actions": {
        "pattern": "Rightmost column: icon buttons (ghost) always visible on desktop; on mobile use kebab dropdown.",
        "components": [
          "/app/frontend/src/components/ui/dropdown-menu.jsx",
          "/app/frontend/src/components/ui/button.jsx",
          "/app/frontend/src/components/ui/tooltip.jsx"
        ],
        "data_testids": {
          "row_action": "table-row-action",
          "row_menu": "table-row-menu"
        }
      }
    }
  },

  "navigation_and_ia": {
    "ordering_principle": {
      "rule": "Order by frequency-of-use × criticality × workflow sequence (not org chart).",
      "method": [
        "1) Put daily operational tasks first for the active portal.",
        "2) Group by job-to-be-done (e.g., 'Pay bills' not 'AP module').",
        "3) Keep analytics separate from operations.",
        "4) Put configuration/admin last.",
        "5) Within a group: list in the order users execute tasks."
      ]
    },
    "sidebar_limits": {
      "top_level_target": "<= 10–12 items per portal",
      "why": "Avoid collapse; keep everything visible on 1280x800 with minimal scrolling.",
      "flatten_rule": "If a section has only 1 child, remove the section wrapper and show the item directly."
    },
    "consolidation_rule": {
      "convert_sidebar_item_to_in_page_tab_when": [
        "Destination is a sub-view of the same entity/hub (e.g., Vendor Scorecard belongs inside Vendor detail or Vendor hub).",
        "User expects to stay in context (same filters/date/entity) while switching views.",
        "The page shares the same primary table and only changes a panel/columns.",
        "The destination is used as a secondary analysis view (not a primary workflow entry)."
      ],
      "keep_as_sidebar_item_when": [
        "It is a distinct workflow with its own lifecycle (PR → PO → GR).",
        "It has a unique global filter context or permissions boundary.",
        "It is a high-frequency entry point used independently."
      ]
    },
    "recommended_portal_grouping": {
      "note": "Exact labels can remain Bahasa Indonesia; this is structural.",
      "example_owner_portal": [
        "Cockpit",
        "Analytics",
        "Outlets",
        "Procurement",
        "Inventory",
        "Finance",
        "HR",
        "Admin"
      ],
      "within_portal_sections": {
        "Outlets": ["Daily Sales", "Daily Orders", "End-of-Day", "Petty Cash", "Budgets", "CRM/Reservations", "Outlet Inventory"],
        "Procurement": ["PR", "PO", "GR", "Vendors", "Workboard", "Price Intelligence"],
        "Finance": ["Payments Hub", "AP/AR", "Journals", "Bank Reconciliation", "Reports Hub", "Tax", "Period Closing", "Chart of Accounts"],
        "Admin": ["Users & Roles", "Master Data Hub", "Configuration Hub", "Monitoring", "CMS"]
      }
    },
    "route_safety": {
      "problem": "Some UI elements navigate unexpectedly to other menus.",
      "guideline": [
        "Any clickable card must have ONE primary click target (button/link) and secondary actions as explicit buttons.",
        "Avoid making entire containers clickable if they contain other interactive elements.",
        "Use breadcrumbs + page title to confirm location after navigation."
      ]
    }
  },

  "discoverability": {
    "global_search": {
      "pattern": "Ctrl/⌘K command palette with grouped results by portal/module; show portal badge on each result.",
      "result_row": "[Icon] Label — Path (muted)  |  Portal chip",
      "portal_jump_signal": [
        "If result changes portal, show a small chip 'Switch portal' and confirm via toast after navigation.",
        "Use consistent iconography for 'external/portal jump' (lucide `ArrowUpRight`)."
      ]
    },
    "breadcrumbs": {
      "use": "All detail pages + deep hubs.",
      "component": "/app/frontend/src/components/ui/breadcrumb.jsx",
      "placement": "Directly under PageHeader; single line; truncate middle segments.",
      "data_testids": {
        "crumbs": "page-breadcrumbs"
      }
    },
    "quick_actions": {
      "pattern": "Compact Quick Actions row (3–6) under KPI strip; actions are explicit buttons, not whole-card navigation.",
      "classes": "flex flex-wrap gap-2",
      "components": ["/app/frontend/src/components/ui/button.jsx", "/app/frontend/src/components/ui/tooltip.jsx"],
      "data_testids": {
        "quick_actions": "quick-actions",
        "quick_action": "quick-action"
      }
    },
    "empty_states": {
      "pattern": "Explain why empty + how to fix + primary action.",
      "do": [
        "Show active filters as chips.",
        "Provide 'Clear filters' and 'Create new' actions.",
        "Keep empty state height compact; avoid large illustrations in ERP."
      ],
      "components": ["/app/frontend/src/components/ui/button.jsx", "/app/frontend/src/components/ui/badge.jsx"]
    },
    "nested_tab_discovery": {
      "pattern": "When consolidating pages into tabs: show tab count badges + remember last active tab per user.",
      "components": ["/app/frontend/src/components/ui/tabs.jsx", "/app/frontend/src/components/ui/badge.jsx"]
    }
  },

  "user_flow_guidance": {
    "above_the_fold_rules_1280x800": [
      "Always show: PageHeader (compact) + primary filters/date + primary table/KPI strip without scroll.",
      "Avoid tall hero cards; prefer horizontal KPI strip + 2-column panels.",
      "AI assistant must not consume >25–30% of viewport height on dashboards."
    ],
    "ai_assistant_placement": {
      "dashboard": "Place as a right-side panel card (desktop) or collapsible drawer (mobile). Default collapsed to a 44px header row.",
      "analytics": "Allow full-page AI Q&A, but keep prompt input sticky at bottom and results scrollable.",
      "classes": {
        "collapsed": "h-11",
        "expanded_max": "max-h-[320px]"
      },
      "components": ["/app/frontend/src/components/ui/collapsible.jsx", "/app/frontend/src/components/ui/drawer.jsx", "/app/frontend/src/components/ui/textarea.jsx"]
    }
  },

  "archetype_wireframes_1280": {
    "1_kpi_dashboard": {
      "layout": [
        "[PageHeader: title + date range + global search trigger]",
        "[KPI Snapshot Strip: 6–10 compact items, horizontal scroll on small screens]",
        "[Quick Actions row: 3–6 buttons]",
        "[Main grid: 2 columns]",
        "  - Left: Primary panels (tables/exceptions)",
        "  - Right: Secondary panels (alerts, approvals, AI collapsed card)"
      ],
      "grid_classes": "grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4",
      "panel_spans": {
        "left": "lg:col-span-8",
        "right": "lg:col-span-4"
      }
    },

    "2_data_table_list": {
      "layout": [
        "[PageHeader: title + primary CTA + secondary actions]",
        "[Toolbar row: search | status tabs | filters | density toggle]",
        "[Table wrapper: sticky header + pagination]"
      ],
      "toolbar": {
        "left_cluster": "Search + status tabs",
        "right_cluster": "Filter button (opens Sheet) + Export + Create"
      },
      "components": [
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/sheet.jsx",
        "/app/frontend/src/components/ui/table.jsx",
        "/app/frontend/src/components/ui/pagination.jsx"
      ]
    },

    "3_hub_with_tabs": {
      "layout": [
        "[PageHeader: hub title + global actions]",
        "[Tabs (pill) directly under header]",
        "[Tab content area: each tab has its own compact toolbar + table/panels]"
      ],
      "rule": "This is the consolidation target: remove redundant sidebar items that are just tabs of this hub."
    },

    "4_kanban_workboard": {
      "layout": [
        "[PageHeader: board title + filters + view switch (Kanban/Table)]",
        "[Compact filter row: assignee, status, date]",
        "[Kanban columns: horizontal scroll; each column header sticky within scroll area]",
        "[Card: compact, 2-line title, meta chips, inline quick actions]"
      ],
      "components": [
        "/app/frontend/src/components/ui/scroll-area.jsx",
        "/app/frontend/src/components/ui/badge.jsx",
        "/app/frontend/src/components/ui/dropdown-menu.jsx"
      ]
    },

    "5_multi_step_workflow_wizard": {
      "layout": [
        "[PageHeader: workflow name + outlet/date context]",
        "[Step rail: left (desktop) / top (mobile)]",
        "[Main step content: form/table]",
        "[Sticky footer: Back/Next/Submit + validation summary]"
      ],
      "components": [
        "/app/frontend/src/components/ui/progress.jsx",
        "/app/frontend/src/components/ui/form.jsx",
        "/app/frontend/src/components/ui/separator.jsx"
      ],
      "sticky_footer_classes": "sticky bottom-0 glass-panel backdrop-blur border-t px-3 py-2 flex items-center justify-between"
    },

    "6_master_data_crud_config": {
      "layout": [
        "[PageHeader: entity name + Create button]",
        "[Split: left list/table | right detail editor (on desktop)]",
        "[On mobile: list → detail via Drawer/Sheet]"
      ],
      "components": [
        "/app/frontend/src/components/ui/resizable.jsx",
        "/app/frontend/src/components/ui/drawer.jsx",
        "/app/frontend/src/components/ui/dialog.jsx"
      ]
    },

    "7_ai_assistant_page": {
      "layout": [
        "[PageHeader: AI Q&A + context selector (portal/module/date)]",
        "[Two-pane: left conversation, right 'Suggested queries' + 'Data sources used']",
        "[Sticky prompt input at bottom]"
      ],
      "components": [
        "/app/frontend/src/components/ui/textarea.jsx",
        "/app/frontend/src/components/ui/card.jsx",
        "/app/frontend/src/components/ui/scroll-area.jsx"
      ]
    },

    "8_detail_record_pages": {
      "layout": [
        "[Breadcrumbs]",
        "[PageHeader: record title + status pill + primary actions]",
        "[Summary strip: 4–6 compact stats]",
        "[Tabs: Overview | Lines | Activity | Attachments | Scorecard (if applicable)]",
        "[Right rail (optional): approvals, audit log, related links]"
      ],
      "components": [
        "/app/frontend/src/components/ui/breadcrumb.jsx",
        "/app/frontend/src/components/ui/tabs.jsx",
        "/app/frontend/src/components/ui/badge.jsx"
      ]
    }
  },

  "density_before_after": {
    "before": [
      "Oversized PageHeader (text-3xl, large icon, mb-6) consumes vertical space.",
      "KPI cards inconsistent and bloated (p-5, value 28px, icon 36px).",
      "Sidebar too wide (280px) and fonts too large; redundant destinations inflate nav.",
      "Multiple tab styles reduce learnability; unexpected navigation from clickable containers."
    ],
    "after": [
      "Compact type scale: page titles ~20–24px, body ~14–15px, labels 11–12px.",
      "Unified CompactStatCard with 72–88px height; KPI strip becomes the default pattern.",
      "Sidebar width ~248px, <=12 top-level items per portal; redundant pages consolidated into hub tabs.",
      "Predictable archetype layouts: toolbar + tabs + dense table; AI assistant constrained to a panel/drawer."
    ]
  },

  "prioritized_action_list": {
    "p0_this_week": [
      "Unify typography scale + apply to PageHeader, Sidebar, Tabs.",
      "Create/standardize CompactStatCard and replace KPI variants.",
      "Fix sidebar double-active: leaf-only active background; parent indicator only.",
      "Consolidate redundant sidebar items into hub tabs (start with Vendor Scorecard)."
    ],
    "p1_next": [
      "Standardize table toolbar pattern (search, status tabs, filters in Sheet, density toggle).",
      "Add global search (Ctrl/⌘K) with portal jump signaling.",
      "Add breadcrumbs to deep pages + detail pages.",
      "Audit clickable containers to prevent unexpected navigation."
    ],
    "p2_later": [
      "Persist user preferences: last active tab, table density, visible columns.",
      "Add role-based default landing pages and quick actions per role.",
      "Add keyboard shortcuts cheat sheet in command palette."
    ]
  },

  "component_path": {
    "shadcn_ui": {
      "button": "/app/frontend/src/components/ui/button.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "table": "/app/frontend/src/components/ui/table.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx",
      "breadcrumb": "/app/frontend/src/components/ui/breadcrumb.jsx",
      "command": "/app/frontend/src/components/ui/command.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "sheet": "/app/frontend/src/components/ui/sheet.jsx",
      "drawer": "/app/frontend/src/components/ui/drawer.jsx",
      "scroll_area": "/app/frontend/src/components/ui/scroll-area.jsx",
      "dropdown_menu": "/app/frontend/src/components/ui/dropdown-menu.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "collapsible": "/app/frontend/src/components/ui/collapsible.jsx",
      "pagination": "/app/frontend/src/components/ui/pagination.jsx",
      "form": "/app/frontend/src/components/ui/form.jsx",
      "progress": "/app/frontend/src/components/ui/progress.jsx",
      "separator": "/app/frontend/src/components/ui/separator.jsx",
      "sonner": "/app/frontend/src/components/ui/sonner.jsx"
    },
    "existing_css_tokens": {
      "theme_tokens": "/app/frontend/src/index.css",
      "glass_utilities": "glass-card, glass-panel, glass-input, pill-active"
    }
  },

  "image_urls": {
    "note": "No new imagery required for ERP density redesign. Keep existing brand visuals."
  },

  "instructions_to_main_agent": [
    "Do NOT change colors, gradients, or font family. Only adjust sizing/spacing/IA.",
    "Implement typography + spacing tokens by updating shared components (PageHeader, Sidebar, KpiCard/StatCard, Tabs wrappers).",
    "Replace KPI variants with CompactStatCard; use KpiSnapshotStrip as density reference.",
    "Sidebar: reduce width to ~248px; reduce font sizes; implement leaf-only active background to fix double-active.",
    "Apply consolidation rule: move redundant sidebar destinations into hub tabs; keep sidebar <=12 top-level items per portal.",
    "Add data-testid to all interactive and key informational elements (buttons, links, inputs, nav items, KPI values, error banners).",
    "Avoid making whole cards clickable when they contain other controls; use explicit primary action buttons/links.",
    "AI assistant on dashboards must be collapsed by default and constrained (<=320px height when expanded)."
  ],

  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>  \n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
