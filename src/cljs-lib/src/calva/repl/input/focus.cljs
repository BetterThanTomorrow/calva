(ns calva.repl.input.focus
  "Which REPL Input has focus, which decides `calva:replInputFocused`, and which is the last focused
   place, which decides `calva:replInputLastFocused`. The printed code in the Output views has focus, and
   a last focused place, the same way, which decide `calva:printedCodeFocused` and
   `calva:printedCodeLastFocused`.")

(def focused-context "calva:replInputFocused")

(def last-focused-context "calva:replInputLastFocused")

(def printed-code-focused-context "calva:printedCodeFocused")

(def printed-code-last-focused-context "calva:printedCodeLastFocused")

(defn focused-after
  "Returns the id of the REPL Input that has focus after `event`, or nil."
  [focused [event-type id]]
  (case event-type
    :focus id
    (:blur :dispose :hide :deactivate :unmount) (when (not= id focused) focused)
    (:text-editor-focus :terminal-focus :other-focus) nil
    :other focused))

(defn last-focused-after
  "Returns the id of the REPL Input that is the last focused place after `event`, or nil. A REPL Input
   stays the last focused place when it loses the focus, until a text editor, a terminal or another place
   gets it, or its view goes away."
  [last-focused [event-type id]]
  (case event-type
    :focus id
    (:blur :other) last-focused
    (:dispose :hide :deactivate :unmount) (when (not= id last-focused) last-focused)
    (:text-editor-focus :terminal-focus :other-focus) nil))

(def ^:private place-events
  "The events that are about one place, `[place event-type]` by the event's type."
  {:focus [:repl-input :focus]
   :blur [:repl-input :blur]
   :unmount [:repl-input :unmount]
   :printed-code-focus [:printed-code :focus]
   :printed-code-blur [:printed-code :blur]
   :printed-code-unmount [:printed-code :unmount]})

(defn place-event
  "Returns `event` as `place`, `:repl-input` or `:printed-code`, takes it: an event about the other place
   getting the focus is `[:other-focus]`, and any other event about the other place is `[:other]`."
  [place [event-type id :as event]]
  (if-let [[event-place place-event-type] (get place-events event-type)]
    (cond
      (= place event-place) [place-event-type id]
      (= :focus place-event-type) [:other-focus]
      :else [:other])
    event))

(defn places-after
  "Returns `state` with the focus and the last focused place of the REPL Inputs and of the printed code
   after `event`."
  [state event]
  (let [repl-input-event (place-event :repl-input event)
        printed-code-event (place-event :printed-code event)]
    (-> state
        (update :repl-input/focused focused-after repl-input-event)
        (update :repl-input/last-focused last-focused-after repl-input-event)
        (update :printed-code/focused focused-after printed-code-event)
        (update :printed-code/last-focused last-focused-after printed-code-event))))

(defn last-focused-view
  "The view of the last focused place in `state`, a REPL Input or printed code, or nil."
  [state]
  (or (:repl-input/last-focused state) (:printed-code/last-focused state)))

(defn focused-record
  "The record of the place that has focus in `state`: a REPL Input, or the printed code in a view."
  [{:repl-input/keys [focused records] :as state}]
  (if focused
    (get records focused)
    (get-in state [:printed-code/records (:printed-code/focused state)])))
