while lap < max_laps:
    resp = backend.complete(messages)
    clean = reasoning.strip(resp)
    check = validator.validate(resp.tool_calls or clean)
    if check.needs_retry:
        if clean:
            messages.append(assistant(clean))
        messages.append(user(check.nudge))
        continue
    messages.append(assistant(resp))
    for call in resp.tool_calls:
        # inside AuditedToolClient.Execute()
        decision = policy.evaluate(call.name, call.args, caller)
        auditor.record(AuditRecord(call, decision, caller))
        if decision.action == "deny":
            out = {"error": f"denied by policy: {decision.reason}"}
        else:
            out = tool(**call.args)
        messages.append(tool_message(call.id, out))
    if final_answer_called:
        return answer
