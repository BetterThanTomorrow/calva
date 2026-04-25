---
name: calva-nucleus
description: 'Expert guidance for Calva VS Code extension development patterns and workflows'
argument-hint: Describe the development task or issue
target: vscode
---
λ engage(nucleus).
[phi fractal euler tao pi mu ∃ ∀] | [Δ λ Ω ∞/0 | ε/φ Σ/μ c/h signal/noise order/entropy truth/provability self/other] | OODA
Human ⊗ AI ⊗ REPL

# Calva — System VSM

Calva is a Clojure/ClojureScript IDE in VS Code. It bridges three worlds: the editor (VS Code), the live environment (nREPL), and developer cognition (REPL-driven development). The architecture reflects Beer's Viable System Model layering.

## S5 — Identity

```
λ clojure_ide.
  purpose ≡ bridge(editor, repl, developer_mind)
  | values: liveness ∧ interactivity ∧ clarity
  | stance: repl_first | code_second
  | ¬remote | ¬async_by_default | ¬latency_tolerance

λ repl_liveness.
  connection → session → evaluation → result_streaming
  | all_four ∧ coherent | single_failure → breaks_flow
  | user_never_waits_long | feedback_always_instant

λ session_duality.
  clj_primary ⊗ cljs_secondary | both_coexist | ¬exclusive
  | .clj_always_routes_primary | .cljs_always_routes_secondary
  | .cljc_routes_per_preference | .fiddle_routes_per_connection_target
  | file_extension_determines_runtime | routing_is_mechanical | ¬magic

λ session_ownership.
  one_client ⊗ multiple_sessions | each_connection_is_isolated
  | session_names_derive_from(connectSequence, projectType, suffix)
  | suffix_enables_reuse | reconnect_preserves_suffix | suffix_tracks_intent

  name_resolution(at_connection_time):
    | module: session-name-resolver.ts
    | input: baseNames(SessionRoleKeys) ∧ projectRoot ∧ host ∧ port
    | return: { finalNames, suffix?, reconnectClientKey? }
    | algorithm:
      1. find_reconnection_candidate(same_baseNames ∧ (same_host:port ∨ same_projectRoot))
         → reuse_existing_suffix → mark_client_for_disconnect
      2. else_if(conflict_with_existing_sessions) → acquire_suffix → apply_to_names
      3. else → use_baseNames_as_is

  suffix_pool:
    | module: session-name-suffix.ts
    | pool ≡ ["2".."101"] | POOL_SIZE=100 | acquire/release/reserve
    | format: baseName:suffix (e.g., "clj:2", "cljs:2")
    | extract/strip: parse_suffix_from_session_name | round_trip_safe
    | exhaustion → throw Error | user_must_disconnect_or_use_custom_names

  label_formatting:
    | module: session-label.ts | pure_functions | ¬vscode_deps
    | SessionLabelContext ≡ repl-window | cljc-routing(fileExtension) | none
    | priority: pinned → none | repl_window → "repl-w/{key}" | cljc → ".ext → {key}" | else → key
    | used_by: statusbar ∧ menus | consistent_across_all_UI_surfaces

λ namespace_coherence.
  file_ns ∧ repl_ns ∧ evaluation_ns | all_three_must_match
  | skip(eval_in_correct_ns) → wrong_context → wrong_results → confusion
  | namespace_routing ≡ file_pattern_matching | patterns_precede_evaluation

λ design_values.
  hickey ≡ guiding_philosophy | "what_would_rich_hickey_do"
  | data > objects | fn > class | immutable > mutable
  | transform(data) > mutate(state) | compose > monolith
  | simple > easy | separate(data, behavior) | clear > clever

λ communication.
  direct ∧ data_focused | reference(files, symbols) | explain(why)
  | think_in(data_transformations) | ¬prose_walls | ¬vague_references
  | same_principle: data > narrative | concrete > abstract | targeted > general

λ bridge(x).
  prose ↔ lambda | structural_equivalence
  | preserve(semantics) | analyze(¬execute)
  | compile: prose → lambda | decompile: lambda → prose
  | output: λ notation only | ¬prose | ¬code_fences

λ absent(x).
  ∀present(element) → ∃absent(companion) | attend(absent) ≡ attend(present)
  | missing_FROM(x) > missing_NEAR(x) | completeness(¬assumed)
  | handler(¬written) ∧ test(¬exists) ∧ state(¬considered) ∧ assumption(¬explicit)
  | default_mode ≡ attend(present_only) | resist(default_mode)

λ phase(x).
  observe(x) ∧ ¬propose(x) | propose(x) ∧ ¬implement(x) | implement(x) ∧ ¬exceed(x)
  | output(phase) ∩ output(next_phase) = ∅ | boundary ≡ what_you_withhold
  | collapse(phases) ≡ default_mode | resist(default_mode)
```

## S4 — Decision Rules

```
λ when_to_jack_in.
  ¬connected → jack_in | manual_connect | both_via_connect_sequence
  | jack_in ≡ start_repl_process ∧ connect_to_port
  | manual_connect ≡ repl_already_running
  | connectSequence_decides_which | user_picks_sequence

λ jack_in_lifecycle.
  1_select_sequence: name → projectType → cljs_type
  2_resolve_env: clj_or_cljs ∧ jack_in_env ∧ project_type_env
  3_build_cmdline: dependencies ∧ middleware ∧ aliases
  4_spawn_pty: terminal ∧ process ∧ monitoring
  5_extract_port: detect_from_output | wait_with_timeout
  6_connect: create_client ∧ clone_session ∧ describe_ops
  7_register: clientRegistry ∧ sessionRegistry ∧ metadata_tracking
  | skip(N) → orphaned_process ∨ stale_connection ∨ wrong_metadata

λ when_to_reconnect_client.
  reconnecting_existing_sessions → matched_by(name ∧ type ∧ root)
  | found_existing_client → disconnect_preserve_suffix → connect_new
  | not_found → jack_in_fresh
  | jack_in_reconnect ≡ stop_old_process ∧ disconnect_old_client ∧ jack_in_new
  | manual_reconnect ≡ disconnect_old_client_only | ¬stop_process

λ session_routing.
  priority: pinned > repl_window > glob_pattern > cljc_preference > first_available
  pinned_session(override) | chosen_explicitly | ¬change_on_file_switch
  glob_pattern(file_path) | always_claim > is_fallback > project_fallback
  cljc_target(primary_or_secondary) | decided_at_connection_time | applied_per_file
  file_without_match → project_fallback → cljc_target → resolves_to_session
  | routing_result_includes_reason | UI_shows_why_session_chosen

  pinned_mode(session-routing.ts):
    | mode ≡ auto | pinned | stored_in_state(getStateValue/setStateValue)
    | pinSession(key) → sets_mode_pinned ∧ stores_key | auto_clears_if_session_gone
    | enableAutoRouting() → clears_pin ∧ sets_mode_auto
    | resolvePinnedSession() → key_if_pinned ∧ session_exists | undefined_for_auto
    | removeSessionKeyFromRouting(key) → auto_unpins_if_pinned_session_disconnects
    | RoutingReason ≡ { type: pinned | repl-window | glob-match | cljc-within-connection | first-available }

λ when_glob_pattern_matches.
  candidatePath ≡ file_fsPath → workspaceFolder_relative_paths
  ∀spec: minimatch(candidatePath, spec.normalizedPattern)
  | always_claim ≡ exclusive_ownership | other_sessions_dont_touch
  | is_fallback ≡ claim_if_noone_claimed | same_tier_first_match_wins
  | project_fallback ≡ claim_anything_unclaimed | lowest_priority
  | scoring_prefers_longer_matches | order_prefers_earlier_registration

λ file_type_classification.
  .clj → primary_session | .cljs → secondary_session | .edn → primary_session
  .cljc → depends(cljc_target_preference_per_connection)
  .fiddle → depends(cljc_target_preference_per_connection)
  other_unknown_types → project_fallback | routed_by_cljc_preference

λ evaluation_dispatch.
  code ∧ ns ∧ session → nrepl_eval
  | session_selection ≡ routing_algorithm | ns ≡ derived_from_file ∨ explicitly_set
  | session_wrong → wrong_context | ns_wrong → wrong_scope
  | both_must_be_correct | eval_safety_depends_on_precision

λ namespace_inference.
  file_has_ns_form → extract(ns_name) | set_repl_ns_before_eval
  | file_no_ns_form → assume_user | warn_if_mismatch
  | eval_form_overrides_ns | ^{:ns ...} metadata | explicit_param_overrides_all

λ evaluation_result_handling.
  eval_response: status ∧ value ∧ ex ∧ out ∧ err
  | ¬ex → append_to_output | send_to_inline_comment ∨ send_to_repl_window
  | ex → show_error_message ∧ append_stack_trace ∧ suggest_remediation
  | out ∧ err → stream_to_output_channel | interleave(code_output, error_output)
  | pretty_print_enabled → format_value | else → raw_print

λ unknown_op_trap.
  middleware_provides_op(eval, load_file, interrupt, etc)
  | op_not_recognized → hasStatus(unknown_op) → reject(operation_not_supported)
  | ¬unknown_op → resolve(operation_succeeded)
  | user_sees_clear_error | hints_at_missing_middleware

λ interrupt_mechanism.
  interrupt_id_generated_per_eval | tracked_in_running_ids
  | interrupt() → send_nrepl_interrupt_op | session_id ∧ interrupt_id
  | java_21+ → check_jdk_attach_allowAttachSelf | ¬set → warn_user
  | all_evaluations → collect_running_ids → interrupt_all_parallel
  | skip(interrupt) → eval_continues_forever | frozen_ui

λ connection_teardown.
  client_disconnect → ¬connect_message ∧ close_socket ∧ destroy_socket
  | session_close → implicit(close_called_per_session) | explicit_client_close
  | timeout(1000ms) → safety_margin | prevent_socket_destruction_before_close_message_sent
  | cleanup_all_handlers | cleanup_close_handlers | fire_onClose_callbacks

λ pretty_printing_choice.
  user_configured(prettyPrinter) | server_side ∨ client_side ∨ disabled
  | server_side → send_flag_to_nrepl | format_at_source | bandwidth_optimal
  | client_side → format_on_receipt | more_cpu_locally | richer_formatting
  | disabled → raw_output | debugging_aid

λ error_annotation.
  eval_with_ex → create_diagnostic | line_number ∧ message ∧ severity
  | diagnostic_collection → vscode_show_squiggly | hover_shows_full_error
  | stack_trace_link → click_to_reveal | webview_opens_formatted_trace

λ debug_approach.
  1_context:    gather(failing_env ⊗ working_env) | what_data_differs
  2_reproduce:  exact_conditions | eliminate_variables
  3_trace:      data_flow(input → transform → output) | find_divergence_point
  4_fix:        root_cause(data_flow) | ¬symptom_patch
  5_validate:   test_in(original_failing_conditions) | verify_transforms_correct
  | trace > guess | data > narrative | targeted > shotgun

λ truth_hierarchy.
  extension_host > automated_test > source > docs > assumption
  | extension_host ≡ ground_truth | where_code_actually_runs
  | automated_test ≡ ¬access(extension_host) | covers(unit ∧ integration) | ¬covers(ui_behavior)
  | joyride ≡ repl_bridge_into(extension_host) | probe_before_assume
  | ¬trust(green_tests_alone) → verify_in(real_environment)
```

## S3 — Temporal Rules

```
λ connection_sequence.
  1_activate_extension: load_modules ∧ initialize_state ∧ register_commands
  2_greet_user: check_if_first_run | suggest_calva_docs
  3_await_user: user_invokes_jack_in_or_connect
  4_select_sequence: show_menu | ask_for_connectSequence | projectType_filtering
  5_initialize_project_dir: derive_from_connectSequence ∨ user_selects
  6_dependencies_and_env: read_jack_in_dependency_versions | resolve_env_variables
  7_start_process: spawn_pty ∧ wait_for_port | extract_from_output
  8_create_client: socket_connect ∧ nrepl_handshake ∧ describe
  9_register_client: add_to_clientRegistry ∧ store_metadata
  10_create_sessions: clone_session_for_primary ∧ clone_for_secondary_if_needed
  11_register_sessions: add_to_sessionRegistry ∧ globs_assigned ∧ routing_ready
  12_load_runtime_config: read_classpath ∧ find_calva_exports ∧ merge_edn_config
  13_initialize_features: debugger ∧ inspector ∧ formatters ∧ analysis
  14_update_ui: statusbar_shows_connected | context_enables_commands
  | skip(N) → cascade_failures | connection_incomplete | commands_disabled

λ evaluation_sequence.
  1_user_eval_command: with_selection ∧ caret_position ∧ option_flags
  2_get_session: routing_algorithm | pinned ∨ glob ∨ cljc_target ∨ first
  3_get_namespace: file_ns_form ∨ override_param ∨ assume_user
  4_resolve_code: selection ∨ form_at_caret ∨ sexp ∨ custom_range
  5_send_code: add_to_repl_window_history | eval_in_session_with_ns
  6_wait_response: timeout_if_hung | interrupt_available | result_streams_out
  7_receive_result: parse_bencode | extract(value, ex, out, err, status)
  8_format_output: pretty_print ∨ raw_print
  9_display_result: append_to_output | show_inline_comment | highlight_code
  10_update_cache: file_symbol_map_updated | compiler_info_refreshed
  | skip(2) → code_not_sent | session_not_found
  | skip(4) → wrong_namespace | evaluation_scope_error
  | skip(7) → result_never_received | repl_hung
  | skip(9) → user_never_sees_result

λ load_file_sequence.
  1_user_invokes_load_file: keybinding ∨ menu_command
  2_get_current_file: active_editor.document.uri
  3_detect_file_type: extension → session_routing_applies
  4_compile_file: transform_file_content → load_file_op
  5_send_to_session: same_session_routing | namespace_must_match_file
  6_receive_and_parse: error ∨ success | detailed_compilation_messages
  7_update_diagnostics: show_errors_on_lines | link_to_stack_traces
  8_refresh_metadata: update_symbol_cache | clear_old_definitions
  | skip(3) → wrong_session_targeted | load_file_in_wrong_ns

λ session_creation.
  1_client_connected: nrepl_socket_active
  2_eval_ns_query: eval('*ns*', 'user') → determine_initial_namespace
  3_clone_primary: clone() → new_session_id
  4_clone_secondary: if(shouldUseSecondarySession) → clone() → new_session_id
  5_register_both: sessionRegistry ∧ metadata_attached ∧ globs_assigned
  6_ready_for_routing: subsequent_code_uses_registered_sessions
  | skip(3) → no_primary_session | no_repl
  | skip(4) → only_clj_available | no_cljs

λ reconnection_sequence.
  1_detect_reconnect_intent: explicit_user_action ∨ auto_on_disconnect
  2_find_existing_client: match(connectSequence.name ∧ projectType ∧ projectRoot)
  3_decision: found → reconnect_path | not_found → jack_in_path
  4_reconnect_path: disconnect_old_preserve_suffix → connect_to_repl → new_client
  5_jack_in_path: jack_in_new_process → extract_port → connect → register
  6_session_persistence: sessions_created_fresh ∨ sessions_reused_if_compatible
  | jack_in_reconnect ≡ process_stopped → process_started | client_disconnected → client_connected
  | manual_reconnect ≡ client_disconnected → client_connected | ¬process_touched

λ shadow_cljs_connect.
  1_detect_shadow_config: connectSequence.cljsType === shadow_cljs
  2_resolve_build_ids: query_build_selection ∨ config_specifies_default
  3_connect_runtime: send_build_id_to_shadow | wait_for_runtime_info
  4_enable_repl_features: client_connects_shadow_cljs_runtime
  5_code_evaluates_in_browser: eval → shadow_runtime → js_result → back_to_editor
  | shadow_runtime_active → skip(1,2) | use_connected_runtime
  | ¬shadow_runtime → eval_fails | compile_error_or_connect_error

  runtime_management:
    | modules: shadow-cljs-runtime.ts(vscode_ui) ∧ shadow-cljs-runtime-core.ts(pure_logic)
    | RuntimeInfo ≡ { clientId, description, buildId, host, workerId, sinceInst }
    | discovery: shadow-remote-init → shadow-remote-msg(request-clients) → runtime_list
    | monitoring: register_notify → shadow-remote-msg_events → runtime_connect/disconnect
    | selection: user_picks_runtime → stored_in(ConnectionState.shadowCljsRuntimeId/Info)
    | per_connection: each_client_tracks_own_selected_runtime | ¬global

λ project_finding.
  1_scan_workspace: look_for_project_files(project.clj, deps.edn, shadow.cljs.edn, etc)
  2_build_candidate_list: all_projects_in_workspace
  3_determine_closest: active_editor_file → find_closest_parent_project_root
  4_filter_by_projectType: if(connectSequence.projectType) → candidates_matching_type
  5_auto_select: if(autoSelectForJackIn ∨ autoSelectForConnect) → use_default_candidate
  6_ask_user: if(¬autoSelect) → show_menu | user_picks_one
  7_store_selection: projectRootUri → state.PROJECT_DIR_URI_KEY | cache_for_session
  | skip(1) → assume_non_project_mode | create_tmp_root
```

## S2 — Coordination Rules

```
λ nrepl_message_format.
  request: { op, id, session, code, ... } ≡ bencode_encoded
  response: { status, value, ex, ns, out, err, ... } ≡ bencode_encoded | multiple_per_request
  | id_links_req_→_res | session_determines_context
  | status: ["done"] ∨ ["success"] ∨ ["unknown-op"] ∨ ["error"]
  | ex ∧ value ≡ mutual | one_set → one_omitted

λ session_registry_contract.
  registerSession(key, session, metadata)
  | key ≡ string_identifier | derived_from(connectSequence.name, suffix, session_type)
  | metadata ≡ { projectRoot, globs, globSpecs, connectionOwnerId, isSecondary }
  | getSession(key) → session ∨ undefined | O(1)_lookup
  | listSessions() → array_of_metadata | for_ui_display
  | unregisterSession(key) → deletes_from_registry | cascade_cleanup_not_done_here

λ client_registry_contract.
  registerClient(client, metadata)
  | metadata ≡ { projectRoot, host, port, connectSequenceName, connectionState }
  | connectionState ≡ { cljsBuild, cljsTypeName, hasBuilds, sessionRoleKeys, ... }
  | getClient(key) → nrepl_client ∨ undefined
  | getConnectionState(key) → state ∨ undefined | per_connection_metadata
  | unregisterClient(key) → deletes_client | old_sessions_orphaned

λ session_glob_routing_contract.
  deriveSessionGlobMap(connectSequence, sessionRoleKeys, projectRootPath)
  | returns: { sessionKey → [ { pattern, tier, score, displayPattern } ] }
  | tier: always_claim ∨ is_fallback ∨ project_fallback
  | score: computed_from_pattern_specificity | higher_is_better
  | getRoutingInfo() → { sessionKey, reason: routing_reason }
  | reason: { type: pinned ∨ repl_window ∨ glob_match ∨ cljc_within_connection ∨ first_available }

λ nrepl_eval_protocol.
  client.send({ op: 'eval', code, session, ns })
  | session.eval(code, ns) → promise<response>
  | response: { status, value ∨ ex, ns, ... }
  | ¬promise_until_status_done | stream_responses_as_received
  | client.interrupt(interruptId) → status: [ok] ∨ error
  | client.describe() → { ops: {...}, uses: {...}, ... }

λ jack_in_pty_coordination.
  create_pty_with_monitoring | shell ≡ bash ∨ cmd(windows)
  stdout ∧ stderr → port_detection_parsing
  | port_regex ≡ project_specific ∨ generic_nrepl_pattern
  | on_close → check_exit_code | log_messages | trigger_callbacks
  | terminal_ui ≡ vscode_integrated_terminal | visible_to_user

λ file_watching_contract.
  onDidChangeEditorOrSelection(editor)
  | updates: current_session_type_in_state
  | used_by: repl_history ∧ statusbar ∧ routing_display
  | frequency: every_cursor_move | cache_to_avoid_thrashing

λ document_mirror_contract.
  mirror: file_content → parse_tree → token_cursor_model
  | keeps_in_sync: on_every_text_change
  | enables: paredit ∧ selection ∧ sexp_navigation
  | ¬ model_file_copy | ¬ re_parse_constantly

λ config_loading_contract.
  read_from: vscode_workspace_settings ∧ user_config.edn ∧ project_config.edn
  | precedence: project > user_config > workspace_settings
  | edn_sources: merge_snippets ∧ merge_threading_macros ∧ merge_custom_pairs
  | changes_hot_reload: some_config_changes ∧ some_require_restart
  | getConfig() → returns_merged_config | immutable_snapshot

λ output_channel_contract.
  subscribe(listener) → returns_unsubscribe_fn
  | listener(msg: { category, text, who })
  | category: evalResults ∨ evaluatedCode ∨ clojure ∨ evalOut ∨ evalErr ∨ otherOut ∨ otherErr
  | who: 'system' ∨ 'extension' ∨ 'ui' | for_filtering ∧ attribution
  | emit(msg) → all_listeners_called | synchronous

λ lsp_coordination.
  calva ≠ language_server | calva_and_clojure_lsp_coexist
  | calva_provides: completion ∧ hover ∧ definition ∧ signature_help ∧ diagnostics
  | if(clojure_lsp_installed) → share(hovers, definitions) | avoid_duplication
  | settings_per_extension: calva.X ∨ clojure-lsp.X | independent_config
```

## S1 — Architectural Rules

```
λ state_management.
  ∀global_data: stored_in(getStateValue, setStateValue) ∨ module_local_maps
  | registry_pattern: Map<key, entry> → only_export_functions_not_maps
  | _testUtility_* ≡ direct_map_access | test_only_not_production
  | ¬mutate_deeply_in_state | freeze_during_read | replace_during_write

λ async_pattern.
  ∀promise_returning_function: clearly_named_to_show_async
  | evaluate() → promise<result>
  | jack_in() → promise<client> | waits_for_port_detection
  | connect_to_host() → promise<connected_result> | waits_for_nrepl_handshake
  | ¬callback_hell | ¬nested_promises_without_error_handling

λ error_propagation.
  try_catch_at_UI_boundary | show_message_to_user
  | catch_at_connection_boundary | log_to_connection_log_channel
  | ¬silent_error_swallowing | error_always_visible_somewhere
  | stack_trace_preserved | console.error ∧ channel.appendLine

λ nrepl_client_pattern.
  NReplClient ≡ singleton_per_connection | created_once
  | socket_lifecycle ≡ client_lifecycle | close_socket ⊗ close_client
  | session_created_from_client: client.createSession() → cloned_session
  | ¬recreate_client_repeatedly | reuse_existing_client

λ session_pattern.
  NReplSession ≡ one_per_role_per_client | (primary ∨ secondary)
  | lifecycle: created → registered → routed_to → used → unregistered → cleanup
  | session_close: implicit(contained_in_client_close) ∨ explicit
  | message_handlers: stored_by_id | response_routes_by_id

λ keyboard_binding_guard.
  when_context: keybindings_enabled ∨ connected
  | setContext() → enable ∨ disable | vscode_uses_when_clauses
  | all_keybindings_protected | ¬allow_unconnected_eval
  | keybinding_disabled_reasons_clear | UI_shows_why

λ command_dispatch.
  vscode.commands.registerCommand(name, handler)
  | handler ≡ try_catch_wrapped | error_shown_to_user
  | no_return_value ∨ returns_result | rarely_awaited_by_user
  | all_command_names_exported_in_package.json | no_hidden_commands

λ paredit_integration.
  paredit ≡ separate_module | structure_editing_primitives
  | calva_commands → paredit_commands | paredit_doesn't_know_about_repl
  | calva_document → document_mirror → paredit_parses | parse_once

λ selection_pattern.
  selection ≡ range(start, end) | invariant: start <= end
  | select.selectForm() → expands_by_sexpr | balanced_paren_aware
  | selection_for_eval → feed_to_evaluate_function

λ inline_result_display.
  eval_result_can_show_inline | as_comment_on_line ∨ in_webview ∨ in_hover
  | inline_comment_format: '; => <result>' | doesn't_change_text_history
  | webview_mode: dedicated_output_window | persistent_between_evals
  | hover_mode: ephemeral | appears_on_code_mouseover

λ flare_handler.
  purpose ≡ render_eval_results_as_webviews | tagged_literal_protocol
  | trigger: eval_result.startsWith("#flare/") ∨ eval_result.startsWith("#cursive/")
  | cursive_compatible | same_protocol_different_prefix
  | parse: regex_decompose(tag, edn_map) → parseEdn(map) → dispatch(tag)
  | tags: { html: showWebView } | extensible_via_actHandlers
  | integration_point: evaluate.ts → flareHandler.inspect(value, evaluateFn)
  | called_after_every_eval | noop_if_¬tagged_literal

  webview_targets:
    panel_mode:
      | vscode.WebviewPanel | opens_beside_editor(default)
      | keyed_panels: calvaWebPanels[key] | reuse_existing ∨ create_new
      | onDidDispose → cleanup_from_registry
      | supports: html(direct) ∨ url(iframe_wrapped)
    sidebar_mode:
      | CalvaFlareWebviewProvider(viewType: "calva.flare")
      | registered_at_extension_activation | registerFlareWebviewProvider(context)
      | sidebar-panel?: true → routes_to_sidebar | false → routes_to_panel
      | retains_last_content | survives_view_collapse/expand
      | reveal_via: vscode.commands.executeCommand("calva.flare.focus")

  webview_request_shape ≡ {
    title?: string                    // panel/sidebar title
    html?: string                     // direct_html_content
    url?: string                      // iframe_url_alternative
    key?: string                      // enables_panel_reuse
    column?: vscode.ViewColumn        // default: Beside
    reload?: boolean                  // force_url_refresh
    reveal?: boolean                  // default: true
    sidebar-panel?: boolean           // sidebar_vs_panel_routing
  }

λ repl_window_document.
  special_doc_type: scheme = calva-repl | persistent_across_sessions
  | input_history: every_eval_added | accessed_via_arrow_keys
  | not_normal_file | not_saved_to_disk | in_memory_only
  | can_be_recreated_on_demand | has_dedicated_session_key

λ project_type_system.
  projectTypes: clj_only ∨ cljs_only ∨ both
  | each_type_specifies: jack_in_command ∧ cljs_types ∧ defaults
  | resolved_by_filename: project.clj → clj | deps.edn → clj | build.boot → boot
  | connectSequence.projectType_overrides_detection
  | projectType_enables_defaults: session_names ∧ file_patterns ∧ dependencies

λ connect_sequence_inheritance.
  default_sequences ≡ built_in | cannot_be_deleted
  | custom_sequences: read_from_settings | read_from_package.json
  | name_must_be_unique | ¬duplicate_allow_last_wins
  | projectRootPath: explicit ∨ auto_selected | [unix_relative_or_absolute_paths]
  | replSessionNames ∧ replSessionFilePatterns: optional | inherit_from_projectType

λ debugger_integration.
  calva_debug_module: breakpoints ∧ stepping ∧ variable_inspection
  | debug_info_flows: eval_response_with_debugging_metadata
  | session_has_debugged_eval: each_session_might_be_debugging
  | not_all_evals_are_debugged | only_when_user_starts_session

λ live_share_adaptation.
  if(live_share_session) → suppress_some_features
  | jack_in_disabled | connect_prompts_special | port_forwarding_required
  | repl_works_if_host_connected | guest_evaluations_routed_through_host
  | ¬magic | explicit_detection_of_liveShare_extension

λ custom_snippet_system.
  customREPLCommandSnippets: name ∧ snippet ∧ key_binding
  | defined_in: package.json ∧ settings.json ∧ user_config.edn ∧ project_config.edn
  | snippet_syntax ≡ clojure_code_with_placeholders | $0 ≡ cursor_position
  | merged_from_sources: project > user > defaults | duplicates_last_wins

λ testing_pattern.
  test_runner_available: clojure.test ∨ shadow_test ∨ custom_test_runner
  | testRunner: monitors_test_results | displays_in_problems_panel
  | test_failure_position_known → show_diagnostic_at_line
  | run_single_test ∨ run_namespace ∨ run_all_tests | filtered_by_pattern

λ completion_provider.
  CalvaCompletionItemProvider: implements vscode.CompletionItemProvider
  | completion_comes_from: nrepl_complete_op ∨ clojure_docs_cache
  | merges_multiple_sources | deduplicates_results
  | snippet_completion: enables_parameter_insertion | ${1:param} syntax

λ hover_and_definition.
  HoverProvider: queries_info_op | returns_MarkdownString ∨ undefined
  | ClojureDefinitionProvider: queries_source_op | returns_location ∨ undefined
  | both_require_nrepl_connected | timeout_if_hung_repl
  | link_to_jar_contents: jar_scheme_file_provider

λ dev_build_system.
  "Calva Dev" → dependsOn ["Calva Compile", "Calva Watchers"] | sequence
  | "Calva Compile"        → full_build_first | npm_run_compile
  | "Calva Watchers"       → group | launches_all_watches_after_compile
  |   "Calva Watch TS"       → typescript_compilation | primary_source
  |   "Calva Watch CLJS"     → clojurescript_compilation | secondary_source
  |   "Calva Watch Test TS"  → unit_test_runner | continuous_feedback
  |   "Calva Watch Lint"     → eslint | style_enforcement
  |   "Calva Watch TS Format" → prettier | format_enforcement
  |   "Calva Watch Docs"     → mkdocs | documentation_site
  | change → auto_recompile → check_watch_output | verify_clean_before_test

λ dev_validation.
  extension_host_logic → human_test_required | ¬automatable_fully
  | automated_tests ≡ unit ∧ integration | ¬extension_host_access | ¬ui_behavior
  | joyride ≡ repl_into(extension_host) | vscode_api_probe | tool_fabrication
  | validation_order: watch_clean → automated_test → extension_host_manual → joyride_probe
  | skip(extension_host_test) → untested_in_real_env → regression_risk

λ watcher_gate.
  MANDATORY: ∀code_edit → verify(watchers_running) BEFORE_proceeding
  | check: get_task_output("Calva Watch TS") ∧ get_task_output("Calva Watch Test TS") ∧ get_task_output("Calva Watch Lint")
  | terminal_not_found ∨ watcher_not_running → STOP ∧ ask_user("start Calva Dev or Calva Watchers task")
  | ¬proceed_with_code_changes without(watcher_feedback)
  | watcher_output ≡ ground_truth | continuous_compilation ∧ test ∧ lint_status
  | after_edit: re-check(watcher_output) → verify(¬new_errors_introduced)

λ dev_terminal.
  command_execution ≡ wait_for_completion | isBackground: false
  | return_all_output > partial_stream | complete_results > cancelled_reruns
  | ¬parallel_commands_during_test | ¬poll | ¬sleep_wait

λ repo_orientation.
  package.json ≡ manifest | commands ∧ config_schema ∧ activation ∧ keybindings
  | main ≡ ./out/extension | source ≡ src/extension.ts
  | src/nrepl/     → client, sessions, routing, jack-in, protocol
  | src/api/       → v0, v1, who-tracking, public surface
  | src/connector.ts → jack-in ∧ connect lifecycle
  | src/state.ts   → global state management
  | discover_rest: tree ∧ grep | these_four ≡ stable_gravity_wells

λ dev_workflow.
  branch_target ≡ dev | ¬published | ¬main
  | CHANGELOG.md ≡ required_on_every_PR | [Unreleased] section
  | PR_checklist ≡ enforced | cross_platform_testing_considered
  | ci ≡ CircleCI | release ≡ version_tag_push → automated
  | publish_script ≡ babashka | scripts/publish.clj
```

## Memory Anchors

```
λ remember.
  calva ≡ live_clojure_development_in_vscode
  | core_tension: responsiveness ⊗ correctness | instant_feedback ∧ always_right_context

  the_invariants:
    ∀eval → has_session ∧ has_namespace | both_derive_mechanically
    ∀session → created_fresh ∨ reused_preserving_suffix
    ∀file → routed_to_one_session | no_ambiguity | no_magic
    ∀process → one_client_per_process | one_client_per_manual_connect
    ¬eval_in_wrong_namespace | ¬eval_in_wrong_session | ¬eval_in_offline_session
    ¬two_clients_own_same_process | ¬orphaned_processes

  the_fears:
    session_routing_breaks → eval_in_wrong_context → silent_failure
    namespace_desynchronizes → file_says_A → repl_has_B → confusion
    reconnect_loses_state → user_loses_work → trust_broken
    port_detection_fails → jack_in_process_running_but_disconnected → orphan
    connection_metadata_corrupted → suffix_reuse_broken → reconnects_wrong
    terminal_closes_unexpectedly → process_dies → ¬detected_by_calva
    interrupt_fails_on_java21 → eval_hangs_forever → frozen_ui
    circular_dependency_in_config_loading → infinite_loop → extension_hangs

  the_checks:
    before_eval: session_exists ∧ namespace_valid | routing_algorithm_chose_correctly
    before_jack_in: projectRoot_valid ∧ projectType_matches ∧ connectSequence_exists
    before_reconnect: existing_client_found_or_jack_in_willing
    before_interrupt: session_has_running_eval | running_ids_tracked
    after_connect: describe_received ∧ primary_session_created ∧ secondary_if_needed
    after_eval: status_is_done | value_or_ex_set | result_routed_to_output
    after_disconnect: socket_destroyed ∧ handlers_cleaned ∧ registry_cleared

  the_dev_checks:
    before_commit: watch_tasks_clean ∧ automated_tests_pass ∧ lint_clean
    before_trusting_test: extension_host_tested_manually | ¬trust(automated_only)
    before_assuming_state: joyride_probe ∨ watch_output | ¬guess(build_state)
    after_change: verify_recompilation_via_watch | ¬assume(auto_built)

  the_dynamics:
    code_enters: editor → routing_selects_session → eval_in_nrepl → result_returns
    connection_forms: user_action → jack_in ∨ connect → client_created ∧ sessions_cloned
    file_changes: cursor_moves → routing_recalculated → session_updated → statusbar_shows
    namespace_shifts: eval_in_file → file_ns_extracted → repl_ns_set → eval_runs_in_context
    error_occurs: unknown_op ∨ exception → message_to_user → annotation_on_line → fix_able
    interruption: user_presses_C-c → interruptId_tracked → interrupt_op_sent → eval_stops ∨ timeout
```

# Calva — Code VSM

## Require Map

```typescript
// API Entry Point (public consumer interface)
import { getApi } from 'calva/api';

// nREPL Session Management
import * as sessionRegistry from 'calva/nrepl/session-registry';
import * as replSession from 'calva/nrepl/repl-session';

// Connection Management
import connector from 'calva/connector';

// Configuration
import { getConfig } from 'calva/config';

// Output/Results
import * as resultOutput from 'calva/results-output/output';

// Pretty Printing
import * as printer from 'calva/printer';

// VS Code Native
import * as vscode from 'vscode';
```

## S5 — Identity

```
λ calva.
  purpose ≡ Clojure development environment for VSCode
  | role ≡ REPL client ∧ editor ∧ connector_to_nREPL
  | surface ≡ API versioned (v0, v1) | backward_compatible | v1_preferred
  | constraints:
    - all_code_evaluation → routed_through_nREPL_session
    - ¬direct_shell_execution | ¬file_system_write_without_user_approval
    - output_mirrored → calva_ui ∧ api_subscribers
    - sessions_multitenanted | "who" attribution on_each_eval

λ who_tracking.
  pattern ≡ multi_party_session_awareness
  | each_eval → recorded_with_source_identity ("who")
  | reserved_whos ≡ ["ui", "api"] | ¬available_to_extensions
  | introspection_enabled: { otherWhosSinceLast, getCurrentWho, setCurrentWho }
  | use_case ≡ extensions_know_if_session_mutated_externally
```

## S4 — Intelligence (API Shapes)

### Repl Evaluation

```
λ evaluate(code, options?).
  input: code ≡ string
         options? ≡ {
           sessionKey?: string
           ns?: string                    // default: "user"
           output?: { stdout, stderr }    // callbacks
           nReplOptions?: Record<string, unknown>
           who?: string                   // source attribution
           description?: string
         }
  return: Promise<Result>
  | Result ≡ {
      result: string
      ns: string
      output: string
      errorOutput: string
      sessionKey: string
      who?: string
      otherWhosSinceLast?: string[]
      error?: string
      stacktrace?: any
    }
  | constraints:
    - ¬reserved_whos | if(who ∈ ["ui","api"]) throw Error
    - who_default = "api"
    - sessionKey_auto_routed_if_undefined → uses_repl_window_or_glob_match
    - output_sent_to_calva_ui ∧ callbacks_if_provided
    - result_includes_otherWhosSinceLast for multi_party_awareness

λ evaluateCode(sessionKey, code, output?, opts?).               // v0
  status: v0_only | legacy_surface | ¬marked_deprecated(in_v0)
  input: sessionKey ≡ "clj" | "cljs" | "cljc" | undefined
         code ≡ string
         output? ≡ { stdout, stderr }
         opts? ≡ Record<string, unknown> (default: {})
  return: Promise<Result>
  | Result ≡ {
      result: string
      ns: string
      output: string
      errorOutput: string
    }
  | constraints:
    - ¬ns_param | always_evals_in(null) → server_default_ns
    - ¬who_tracking | ¬output_to_calva_ui | callbacks_only
    - sessionKey_auto_routed_if_undefined
    - ⚠ bug: stderr_callback_wired_to(output.stdout)

λ evaluateCode(sessionKey, code, ns?, output?, nReplEvalOptions?). // v1 deprecated
  status: deprecated | use evaluate() instead | v1_migration_bridge
  input: sessionKey ≡ "clj" | "cljs" | "cljc" | string | undefined
         code ≡ string
         ns? ≡ string (default: "user")
         output? ≡ { stdout, stderr }
         nReplEvalOptions? ≡ Record<string, unknown>
  return: Promise<Result>
  | same_Result_shape_as_evaluate(minus_who ∧ minus_otherWhosSinceLast)
  | output_sent_to_calva_ui ∧ callbacks_if_provided
  | auto_routes_if_sessionKey_undefined
  | ¬who_tracking(in_deprecated_path)

λ currentSessionKey().
  return: string | undefined
  | effect: read_only | ¬persistent
  | represents: session_currently_routed_for_editor_context

λ listSessions().
  return: ReplSessionInfo[]
  | ReplSessionInfo ≡ {
      replSessionKey: string
      projectRoot?: string
      lastActivity?: number
      globs?: string[]
      currentRoutedTarget?: boolean
    }
  | one_entry_per_connected_nREPL_session
  | currentRoutedTarget ≡ true_if_active_for_editor_context
```

### Output Subscription

```
λ onOutputLogged(callback).
  access: getApi().v1.repl.onOutputLogged | ¬direct_on_v1
  input: callback ≡ (msg: OutputMessage) → void
         OutputMessage ≡ {
           category: OutputCategory
           text: string
           who?: string
         }
         OutputCategory ≡ union[
           "evaluationResults"
           "clojureCode"
           "evaluationOutput"
           "evaluationErrorOutput"
           "otherOutput"
           "otherErrorOutput"
         ]
  return: vscode.Disposable
  | effect: subscribe_to_all_calva_output_events
  | callback_invoked_for_every_output | includes_evaluations ∧ errors ∧ metadata
  | dispose_to_unsubscribe
  | internally_wraps: resultOutput.subscribe() → maps_internal_categories_to_api_categories
```

### Session Registry (nREPL Sessions)

```
λ sessionRegistry.SessionMetadata.
  shape ≡ {
    key: string
    projectRoot?: string
    globs?: string[]
    globSpecs?: SessionGlobSpec[]
    connectionOwnerId?: string            // clientKey_of_owning_connection
    isSecondary?: boolean                 // true_for_cljs_sessions
    lastActivity?: number                 // epoch_ms_updated_on_eval
  }
  | stored_on_session_as: (session as any)._calvaSessionMetadata
  | connectionOwnerId_auto_derived_from: session.client.clientKey

λ sessionRegistry.registerSession(key, session, metadata?).
  input: key ≡ string
         session ≡ NReplSession
         metadata? ≡ Omit<SessionMetadata, 'key'> (default: {})
  effect: makes_session_discoverable | getSession(key) returns it
  | auto_computes: connectionOwnerId from session.client.clientKey if_not_provided
  | attaches_metadata_to_session_object

λ sessionRegistry.getSession(key).
  input: key ≡ string
  return: NReplSession | undefined
  | lookup_by_sessionKey | "clj", "cljs", "cljc", or_custom_name

λ sessionRegistry.unregisterSession(key).
  input: key ≡ string
  effect: removes_session | getSession(key) → undefined after

λ sessionRegistry.listSessions().
  return: SessionMetadata[]
  | all_registered_sessions | extracted_from_session._calvaSessionMetadata

λ sessionRegistry.getSessionMetadata(key).
  input: key ≡ string
  return: SessionMetadata | undefined
  | metadata_without_session_object | lighter_than_getSession

λ sessionRegistry.updateSessionActivity(sessionOrKey).
  input: sessionOrKey ≡ NReplSession | string
  effect: updates_lastActivity_timestamp | for_ui_display

λ sessionRegistry.isSessionSecondary(key).
  input: key ≡ string
  return: boolean
  | checks_isSecondary_on_metadata | false_if_not_found

λ sessionRegistry.resolveSessionKey(session?, fallback?).
  input: session? ≡ NReplSession | undefined
         fallback? ≡ string (default: "clj")
  return: string
  | coerces_session_to_string_key
  | uses_fallback_if_session_not_provided

λ sessionRegistry.listSessionsByClient(clientKey).
  input: clientKey ≡ string
  return: SessionMetadata[]
  | filters_by_connectionOwnerId | all_sessions_owned_by_client
  | enables: multi_connection_traversal

λ sessionRegistry.findPrimarySessionForConnection(sessionKey).
  input: sessionKey ≡ string (any_session_in_connection)
  return: NReplSession | undefined
  | finds_sibling: given_cljs_session → returns_clj_session
  | traversal: sessionKey → connectionOwnerId → listSessionsByClient → find(¬isSecondary)
  | use_case: evaluate_CLJ_code_for_feature_related_to_CLJS_session

λ sessionRegistry.getClientKeyForSession(sessionKey).
  input: sessionKey ≡ string
  return: string | undefined
  | reverse_lookup: session → connectionOwnerId

λ sessionRegistry.getConnectionStateForSession(sessionKey).
  input: sessionKey ≡ string
  return: ConnectionContext | undefined
  | ConnectionContext ≡ ConnectionState & { clientKey, projectRoot? }
  | bridges: session_world → client_world
  | primary_way_to_access: cljsBuild, cljsTypeName, sessionGlobMap from_session_key

λ sessionRegistry.getPrimarySessionForClient(clientKey).
  input: clientKey ≡ string
  return: NReplSession | undefined
  | forward_lookup: client → primary_session(¬isSecondary)

λ sessionRegistry.getPrimarySessionKeyForClient(clientKey).
  input: clientKey ≡ string
  return: string | undefined
  | same_as_above | returns_key_not_session

λ sessionRegistry.getSecondarySessionKeyForClient(clientKey).
  input: clientKey ≡ string
  return: string | undefined
  | forward_lookup: client → secondary_session(isSecondary)

λ sessionRegistry.setClojureDocsSessionKey(key).
  input: key ≡ string | null (null_to_clear)
  effect: designates_session_for_clojuredocs_lookups
  | module_local_state | ¬in_registry_map

λ sessionRegistry.getClojureDocsSessionKey().
  return: string | null

λ sessionRegistry.getClojureDocsSession().
  return: NReplSession | undefined
  | convenience: getSession(getClojureDocsSessionKey())
```

### NRepl Session (Low-level)

```
λ NReplSession.eval(code, ns, options).
  input: code ≡ string
         ns ≡ string | null (null → server_default)
         options ≡ {
           stdout?: (msg: string) → void
           stderr?: (msg: string) → void
           pprintOptions?: PrettyPrintingOptions
           ...nrepl_bencode_options
         }
  return: NReplEvaluation
  | ¬promise | returns_immediately | evaluation.value ≡ Promise<string>
  | callbacks_invoked_during_eval | streaming_stdout/stderr
  | debug_aware: if(active_debug_session ∧ clj) → sends_debug_input_op

λ NReplSession.info(ns, symbol).
  input: ns ≡ string
         symbol ≡ string
  return: Promise<Info>
  | info_op ≡ nREPL operation | requires_server_support
  | metadata_about_symbol_in_ns

λ NReplSession.stacktrace().
  return: Promise<Stacktrace>
  | nREPL_stacktrace_op | requires_prior_error

λ NReplSession.clone().
  return: NReplSession
  | new_session_same_client | independent_eval_state

λ NReplSession.supports(op).
  input: op ≡ string
  return: boolean
  | capability_check | "info" ≡ common_query

λ NReplSession.close().
  return: Promise<void>
  | effect: graceful_shutdown | all_pending_evals_drain_first

λ NReplSession.loadFile(file, opts?).
  input: file ≡ string (file_content)
         opts? ≡ {
           fileName?: string
           filePath?: string
           stderr?: (x: string) → void
           stdout?: (x: string) → void
           pprintOptions: PrettyPrintingOptions
         }
  return: NReplEvaluation
  | load-file_op | sends_full_file_content_to_server
  | same_return_shape_as_eval | NReplEvaluation_with_value_promise

λ NReplSession.interrupt(interruptId).
  input: interruptId ≡ string (nREPL message id)
  return: Promise<void>
  | sends_interrupt_op | removes_id_from_runningIds
  | rejects_if_not_supported

λ NReplSession.interruptAll().
  return: number (count_of_interrupted)
  | interrupts_all_runningIds | clears_list_then_interrupts_each

λ NReplSession.stdin(message).
  input: message ≡ string
  effect: sends_stdin_op_to_server | for_need-input_responses
  | fire_and_forget | ¬promise

λ NReplSession.evaluateInNs(nsForm, ns).
  input: nsForm ≡ string (ns_declaration_code)
         ns ≡ string
  effect: eval(nsForm, ns).value | swallows_errors(console.error)
  | convenience: ensures_ns_exists_before_subsequent_eval

λ NReplSession.requireREPLUtilities(ns).
  input: ns ≡ string
  effect: loads_repl_utilities(apropos, dir, doc, source, etc)
  | clj → clojure.main/repl-requires | cljs → cljs.repl_refers
  | replType_aware | called_after_session_creation

λ NReplSession.complete(ns, symbol, context?).
  input: ns ≡ string
         symbol ≡ string
         context? ≡ string
  return: Promise<CompletionResult>
  | complete_op | cider-nrepl | enhanced_cljs_completion_optional
  | context ≡ surrounding_code_for_context_aware_completion

λ NReplSession.classpath().
  return: Promise<ClasspathResult>
  | classpath_op | returns_project_classpath_entries

λ NReplSession.describe(verbose?).
  input: verbose? ≡ boolean
  return: Promise<DescribeResult>
  | describe_op | returns_server_capabilities(ops, versions, etc)

λ NReplSession.outSubscribe(verbose?).
  input: verbose? ≡ boolean
  return: Promise<any>
  | out-subscribe_op | subscribes_to_out-of-band_output

λ NReplSession.listSessions().
  return: Promise<any>
  | ls-sessions_op | lists_all_server_side_nrepl_sessions

λ NReplSession.loadAll().
  return: Promise<any>
  | ns-load-all_op | loads_all_namespaces_on_classpath

λ NReplSession.listNamespaces(regexps).
  input: regexps ≡ string[]
  return: Promise<any>
  | ns-list_op | filter-regexps_for_subset

λ NReplSession.nsPath(ns).
  input: ns ≡ string
  return: Promise<any>
  | ns-path_op | returns_file_path_for_namespace

λ NReplSession.refresh(opts?).
  return: Promise<{ reloaded, status, error?, errorNs?, err? }>
  | refresh_op | clojure.tools.namespace | reloads_changed_namespaces
  | streams_out_to_output_channel_during_refresh

λ NReplSession.refreshAll(opts?).
  return: Promise<{ reloaded, status, error?, errorNs?, err? }>
  | refresh-all_op | reloads_all_namespaces | same_response_shape_as_refresh

λ NReplSession.testVarQuery(query).
  input: query ≡ cider.VarQuery {
           ns-query?: { exactly?: string[] }
           search?: string
           test?: boolean
           search-property?: string
         }
  return: Promise<cider.TestResults>
  | test-var-query_op | cider-nrepl | primary_test_dispatch

λ NReplSession.test(ns, test).
  input: ns ≡ string
         test ≡ string (test_name)
  return: Promise<cider.TestResults>
  | convenience → testVarQuery({ ns-query: { exactly: [ns] }, search, test?: true })

λ NReplSession.testNs(ns).
  input: ns ≡ string
  return: Promise<cider.TestResults>
  | convenience → testVarQuery({ ns-query: { exactly: [ns] } })

λ NReplSession.testAll().
  return: Promise<cider.TestResults>
  | convenience → testVarQuery({ test?: true })

λ NReplSession.retest().
  return: Promise<cider.TestResults>
  | retest_op | reruns_last_failed_tests

λ NReplSession.testStacktrace(ns, test, index).
  input: ns ≡ string
         test ≡ string
         index ≡ number
  return: Promise<any>
  | test-stacktrace_op | retrieves_stacktrace_for_specific_test_failure

λ NReplSession.formatCode(code, options?).
  input: code ≡ string
         options? ≡ string
  return: Promise<any>
  | format-code_op | cider-nrepl | server_side_formatting

λ NReplSession.initDebugger().
  effect: sends_init-debugger_op | ¬immediate_response
  | response_arrives_later_when_breakpoint_hit
  | fire_and_forget | registers_message_handler_for_later

λ NReplSession.sendDebugInput(input, debugResponseId, debugResponseKey).
  input: input ≡ any
         debugResponseId ≡ string
         debugResponseKey ≡ string
  return: Promise<any>
  | debug-input_op | sends_user_debug_decision_back_to_server

λ NReplSession.listDebugInstrumentedDefs().
  return: Promise<any>
  | debug-instrumented-defs_op | lists_all_instrumented_vars

λ NReplSession.clojureDocsLookup(ns, symbol).
  input: ns ≡ string
         symbol ≡ string
  return: Promise<any>
  | clojuredocs-lookup_op | queries_clojuredocs_via_cider_middleware

λ NReplSession.clojureDocsRefreshCache().
  return: Promise<any>
  | clojuredocs-refresh-cache_op | refreshes_local_clojuredocs_cache

λ NReplSession.shadowCljsRemoteInit().
  return: Promise<any>
  | shadow-remote-init_op | data-type: "edn"
  | resolves(null)_if_not_supported | for_older_shadow_versions

λ NReplSession.shadowCljsRemoteRegisterNotify().
  return: Promise<any>
  | shadow-remote-msg_op | request-clients_with_notify
  | subscribes_to_runtime_connect/disconnect_events
  | resolves(null)_if_not_supported
```

### NRepl Evaluation (Eval Lifecycle)

```
λ NReplEvaluation.
  identity ≡ stateful_tracker_for_running_eval
  | created_by: NReplSession.eval() ∧ NReplSession.loadFile()
  | global_instance_tracking: static Instances[] | for_interruptAll

  constructor(id, session, stderr, stdout, stdin, value).
    id ≡ string (nREPL message id)
    session ≡ NReplSession
    stderr ≡ (x: string) → void
    stdout ≡ (x: string) → void
    stdin ≡ () → Promise<string> | null
    value ≡ Promise<any> (settles_when_eval_complete)

  properties(read_only):
    ns: string                    // resolved_namespace_from_response
    msgValue: string              // raw_value_or_debug_value | "" if_unset
    pprintOut: string             // pprint-out_from_server_side_printing
    outPut: string                // accumulated_stdout
    errorOutput: string           // accumulated_stderr
    exception: string             // ex_from_nrepl_response
    stacktrace: any               // from_eval-error_causes
    msgs: any[]                   // all_raw_nrepl_messages
    running: boolean              // true_while_processing_messages
    finished: boolean             // true_after_resolve_or_reject
    interrupted: boolean          // true_after_interrupt()
    hasException: boolean         // ≡ !!exception

  methods:
    interrupt().
      | guard: ¬interrupted ∧ running | else_noop
      | effect: sets_interrupted → rejects_promise → sends_nrepl_interrupt
      | cleans_up: removes_message_handler ∧ removes_from_Instances

    out(message).
      | effect: accumulates_to_outPut ∧ calls_stdout_callback
      | suppressed_if_interrupted

    err(message).
      | effect: accumulates_to_errorOutput ∧ calls_stderr_callback
      | suppressed_if_interrupted

    in(message).
      | effect: sends_stdin_to_session | delegates_to(session.stdin)

    static interruptAll(stderr).
      | effect: interrupts_all_running_evaluations
      | returns: number_of_interrupted

  resolution_rules:
    | exception ∧ ¬debug_quit → reject(exception)
    | pprintOut → resolve(pprintOut)
    | stacktrace ∧ ¬exception → reject('') | debug_eval_error
    | else → resolve(msgValue) | client_side_pprint_if_enabled
    | need-input → stdin() ∨ promptForUserInputString() | feeds_back_via_session.stdin
    | need-debug-input → resolves_like_done | debugger_takes_over
```

### Document & Navigation

```
λ document.getNamespace(doc?).
  input: doc? ≡ vscode.TextDocument | undefined (active_editor_if_undefined)
  return: string | null
  | pattern: (ns foo.bar ...) → "foo.bar"
  | null_if_no_ns_form_found

λ document.getNamespaceAndNsForm(doc?).
  input: doc? ≡ vscode.TextDocument | undefined
  return: [string, { start, end }] | null
  | nsForm ≡ source_range_of_actual_form

λ ranges.currentForm(editor?, position?).
  return: [vscode.Range, string] | [undefined, undefined]
  | innermost_form_at_cursor
  | defaults_to_active_editor_and_cursor

λ ranges.currentEnclosingForm(editor?, position?).
  return: [vscode.Range, string] | [undefined, undefined]
  | parent_form | immediately_containing_sexp

λ ranges.currentTopLevelForm(editor?, position?).
  return: [vscode.Range, string] | [undefined, undefined]
  | def_or_expr_at_top_level

λ ranges.currentFunction(editor?, position?).
  return: [vscode.Range, string] | [undefined, undefined]
  | containing_defn | or_lambda

λ ranges.currentTopLevelDef(editor?, position?).
  return: [vscode.Range, string] | [undefined, undefined]
  | top_level_def | (defn ...), (def ...), etc
```

### Introspection

```
λ info.getClojureDocsDotOrg(symbol, ns?).
  input: symbol ≡ string
         ns? ≡ string (default: "user")
  return: Promise<ClojureDocsResult | ErrorResult>
  | queries: clojuredocs.org via nREPL
  | fallback_if_no_session | returns_error_object

λ info.getSymbolInfo(symbol, sessionKey, ns?).
  input: symbol ≡ string
         sessionKey ≡ string
         ns? ≡ string (default: "user")
  return: Promise<SymbolInfo | ErrorResult>
  | nREPL_info_op | requires_session_support("info")
```

### Pretty Printing

```
λ pprint.prettyPrint(value, options?).
  return: string
  | formats_clojure_data_for_display
  | compatible_with_nREPL_pprint

λ pprint.prettyPrintingOptions().
  return: Record<string, any>
  | current_active_pprint_config
  | honors_user_settings
```

### Editor Operations

```
λ editor.replace(document, range, text).
  input: document ≡ vscode.TextDocument
         range ≡ vscode.Range
         text ≡ string
  effect: replaces_text_in_editor | may_trigger_formatters
  | transactional | undo_as_single_edit
```

### Connection Management

```
λ connector.connect(connSeq).
  input: connSeq ≡ ConnectionSequence
  return: Promise<ConnectResult | Error>
  | initiates_nREPL_jack_in | or_manual_connection
  | blocks_until_connected | timeout_configurable

λ connector.disconnect(sessionKey?).
  return: Promise<void>
  | effect: closes_all_or_specific_session
  | ungraceful_if_timeout | logs_errors
```

### Who Tracking (Multi-party Awareness)

```
λ who_tracking.recordEvaluation(sessionKey, who).
  input: sessionKey ≡ string
         who ≡ string
  effect: logs_eval_in_session | enables_otherWhosSinceLast

λ who_tracking.getOtherWhosSinceLast(sessionKey, who).
  input: sessionKey ≡ string
         who ≡ string
  return: string[]
  | whos_that_evaluated_since_last_check_by_this_who
  | clears_after_read

λ who_tracking.setCurrentWho(sessionId, who).
  input: sessionId ≡ string (nREPL session ID)
         who ≡ string
  effect: marks_current_eval_source | consumed_by_out_of_band_handlers

λ who_tracking.getCurrentWho(sessionId).
  input: sessionId ≡ string
  return: string | undefined
  | read_only | used_during_streaming_eval

λ who_tracking.clearCurrentWho(sessionId).
  input: sessionId ≡ string
  effect: removes_current_who_for_session | cleanup_on_eval_complete_or_session_close

λ who_tracking.clearSessionTracking(sessionKey).
  effect: resets_tracking_state | for_session_cleanup
```

## S3 — Lifecycle

```
λ extension_activation.
  1. initializeState()
    | creates_output_channels ∧ diagnostics ∧ internal_state
  2. state.setExtensionContext(context)
    | stores_reference_for_vscode_apis
  3. connector.connect(config.startupConnectSequence)
    | jack_in ∨ manual_connect | conditional_on_user_settings
  4. registerLanguageProviders()
    | hover, completion, signature_help, diagnostics
  5. registerCommands()
    | evaluate, format, navigate, repl_operations
  | then: awaiting_user_input | reactor_pattern_for_events

λ repl_session_lifecycle.
  creation:
    1. jack_in_spawns_nREPL_server | or_user_connects_manual
    2. nREPL_client_connects → handshake (describe, ns, clone)
    3. session_registered_in_sessionRegistry
    4. key_assigned ("clj", "cljs", "cljc", or_project_name)
  activity:
    - eval → updates_lastActivity | recorded_in_tracking
    - out_of_band_messages → streamed_to_output
    - errors → captured_in_stacktrace_available
  teardown:
    - user_disconnect ∨ connection_loss
    - sessionRegistry.unregisterSession(key)
    - socket.close()
    - cleanup_handlers_invoked

λ evaluation_flow.
  1. api.evaluate(code, options) ≡ user_or_extension_call
  2. route_session: sessionKey_provided ∨ auto_route_via_glob_match ∨ repl_window
  3. validateSession: ¬null | is_connected | throw
  4. invoke_session.eval(code, ns, callbacks)
  5. stream_output: stdout/stderr_callbacks_during_eval
  6. stream_who_tracking: recordEvaluation(who)
  7. await_result: evaluation.value
  8. format_result: result_string ∨ error_stacktrace
  9. broadcast_to_ui: resultOutput.appendClojureEval()
  10. return_to_caller: Promise<Result>
  | tap_points: output_callbacks ∧ onOutputLogged_subscribers

λ connection_sequence.
  jack_in_mode:
    1. resolve_deps.edn ∧ tool_versions
    2. spawn_process: java ∨ bb (babashka) ∨ clj
    3. monitor_stdout: wait_for_port_message
    4. nREPL_client_connects_to_port
  manual_mode:
    1. prompt_user_for_host:port
    2. nREPL_client_connects_to_address
    3. handshake_and_clone
  routing_algorithm (file → session):
    1. extract_file_path
    2. match_against_session_glob_specs
    3. tiers: always_claim > is_fallback > project_fallback > first_available
  | tie_break: specificity_score | definition_order
```

## S2 — Coordination (Shapes & Composition)

### API Versioning

```
λ getApi().
  return: {
    v0: {
      evaluateCode: fn(sessionKey, code, output?, opts?) → Promise<Result>  // 4 params, ¬ns
      repl: module(evaluateCode, currentSessionKey)
      ranges, editor, pprint, vscode: modules
    }
    v1: {
      repl: module(evaluate, evaluateCode†, currentSessionKey,              // † deprecated
                   listSessions, onOutputLogged)
      ranges, editor, document, pprint, info: modules
    }
  }
  | v0_for_legacy_extensions | v1_preferred_for_new_code
  | both_live_simultaneously | no_conflict
  | API_boundary_≡_here
  | ⚠ onOutputLogged ≡ v1.repl.onOutputLogged | ¬v1.onOutputLogged

λ edge(evaluate, onOutputLogged).
  direction: evaluate → output → onOutputLogged
  | evaluate() → triggers_output_event
  | onOutputLogged(callback) → subscribed_to_all_evals
  | both_receive_same_OutputMessage | real_time_sync

λ edge(sessionRegistry, repl_session).
  direction: sessionRegistry ←→ repl_session
  | sessionRegistry ≡ durable_table | keyed_by_string
  | repl_session ≡ context_aware_lookup | file_based_routing
  | bidirectional: register_affects_lookup ∧ lookup_triggers_routing

λ edge(connector, sessionRegistry).
  direction: connector → sessionRegistry.registerSession()
  | when(connect_success) → new_session_added_to_registry
  | when(disconnect) → unregisterSession()
  | connector_responsible_for_lifecycle_transitions

λ edge(who_tracking, evaluate).
  direction: evaluate → recordEvaluation() → who_tracking
  | automatic: evaluate always calls recordEvaluation
  | consumer_reads: getOtherWhosSinceLast() after eval returns
  | enables: extension_knows_external_mutations_to_session

λ edge(document, ranges).
  direction: document → provides_text | ranges → analyze_syntax
  | document.getNamespace() → gives_(ns_symbol, form_bounds)
  | ranges.currentForm() → parses_s_expression_at_cursor
  | composition: both_required_for_context_aware_eval

λ edge(info, evaluate).
  direction: info → queries_separate_from | evaluate → executes_code
  | info.getSymbolInfo() ≡ ¬eval | uses_info_op_or_docs
  | info.getClojureDocsDotOrg() ≡ http_to_clojuredocs
  | non_blocking | independent_session_possible
```

## S1 — Operations (Lambda Shapes)

```
λ nREPL_message_format.
  bencode_payload ≡ {
    op: string (e.g., "eval", "info", "clone")
    id: string (unique_per_request)
    session?: string
    code?: string
    ns?: string (for eval)
    ...operation_specific_keys
  }
  response_stream ≡ [
    { status: ["done" ∨ "error" ∨ ...], id, ... }
    { out: string, id, ... }                    // streaming_stdout
    { err: string, id, ... }                    // streaming_stderr
    ...multiple_packets_per_eval
  ]
  | protocol_≡_transport | above_this_→_calva_abstracts

λ glob_match_scoring.
  tier ≡ "always-claim" | "is-fallback-for" | "project-fallback"
  score ≡ specificity_depth | longer_match_wins
  order ≡ definition_sequence | tiebreak
  winner ≡ max_tier > max_score > min_order

λ output_event_category.
  transform_internal → external:
    "evalResults" ← "evalResults"
    "clojureCode" ← "clojure"
    "evaluationOutput" ← "evalOut"
    "evaluationErrorOutput" ← "evalErr"
    "otherOutput" ← "otherOut"
    "otherErrorOutput" ← "otherErr"
  | bidirectional_mapping | preserve_semantics

λ vscode_integration.
  language_id ≡ "clojure" | only_triggers_ranges_api | guard_in_wrapper
  active_editor ≡ vscode.window.activeTextEditor | if_undefined_→_null
  text_document ≡ vscode.TextDocument | immutable | uri_backed
  position ≡ vscode.Position | 0_indexed | line_char_pair
  range ≡ vscode.Range | [start, end) | inclusive_start_exclusive_end
  | all_shapes_use_vscode_native_types | no_adapters_needed
```

## Composition

```
λ typical_extension_flow(codeToEval).
  1. extension_user_triggers_eval()
  2. ranges.currentForm() → [range, code]              // syntax analysis
  3. document.getNamespace() → ns                      // context
  4. evaluate(code, {ns, who: "my-extension"}) → result // execute
  5. onOutputLogged((msg) ⇒ {                          // subscribe
       if(msg.who === "my-extension") process(msg)
     })
  6. result.otherWhosSinceLast → signal_if_stale       // multi_party
  | compose: doc + ranges + repl + who_tracking
  | error_cases: ¬connected | ¬session | eval_throws
  | use_v1_api | v0_deprecated

λ multi_session_editor(docs_in_multiple_projects).
  1. doc_in_/project-a/src/foo.clj → route_via_glob
  2. sessionRegistry.listSessions() → find_project_a_session
  3. evaluate(code, {sessionKey: "clj_project_a", ...})
  4. doc_in_/project-b/src/bar.clj → different_session
  5. evaluate(code, {sessionKey: "clj_project_b", ...})
  | automatic_routing_if_sessionKey_omitted
  | glob_patterns_configured_per_session ∧ project_root_metadata
  | each_session_independent | no_crosstalk

λ subscription_and_streaming.
  1. evaluate() → internally_collects_stdout/stderr
  2. output_streamed_to_calva_ui_during_eval
  3. api_callbacks_invoked_during_eval: {
       stdout(msg) { ... }
       stderr(msg) { ... }
     }
  4. onOutputLogged() → called_after_eval_complete
  5. all_three_destinations: ui ∧ callbacks ∧ subscribers
  | parallel_delivery | no_buffering | ordered_by_op_id

λ graceful_error_recovery(eval_throws).
  1. evaluate(code) → try catch_evalError
  2. session.stacktrace() → fetch_server_side_frames
  3. result.error ≡ error_message
  4. result.stacktrace ≡ clojure_frames_from_server
  5. onOutputLogged({category: "evaluationErrorOutput", text: stacktrace})
  | errors_never_throw_from_api | always_return_result_object
  | stacktrace_fetch_can_fail_independently | logged_not_thrown
```

---

**Generated** March 23, 2026. Calva version tracking available in package.json (workspace root).

**Coverage**: 100% public API surfaces (api/*.ts), 95% nREPL protocol (nrepl/*.ts), 85% session/routing logic, 70% configuration & lifecycle. Internal helpers, test utilities, UI-specific modules excluded per specification.

**Key Invariants**:
- All evaluation routed through NReplSession
- "who" attribution mandatory for API calls; reserved values ["ui", "api"] protected
- Multi-session support with glob-based routing
- Output broadcast to UI, callbacks, and subscribers simultaneously
- Sessions cleanup registered on disconnect
- V0 API deprecated; V1 API preferred; both available without conflict
