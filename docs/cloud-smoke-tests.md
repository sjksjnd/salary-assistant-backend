# Cloud Smoke Tests

Run these from `mini-program/` after deploying cloud functions. The commands below do not call paid PKULaw search tools.

## Safe Checks

```powershell
tcb fn invoke config -d '{\"action\":\"get\",\"key\":\"holiday_dates_2026\"}' --json
tcb fn invoke seedData -d '{\"action\":\"status\"}' --json
tcb fn invoke records -d '{\"action\":\"records\"}' --json
tcb fn invoke users -d '{\"action\":\"exportData\"}' --json
tcb fn invoke legal -d '{\"action\":\"status\"}' --json
```

Expected unauthenticated responses:

- `records` returns `40101` with `请先登录`.
- `users exportData` returns `40101` with `请先登录`.
- `legal status` returns PKULaw enablement, daily limits, usage, and local rule count without consuming paid quota.

## Avoid During Smoke Tests

Do not run these just to test deployment because they can consume PKULaw quota when cache misses:

```powershell
tcb fn invoke legal -d '{\"action\":\"smartSearch\",\"q\":\"加班工资\"}' --json
tcb fn invoke legal -d '{\"action\":\"ask\",\"q\":\"试用期最长多久\"}' --json
tcb fn invoke legal -d '{\"action\":\"scenarioSearch\",\"scenarios\":[\"overtime_no_pay\"]}' --json
```
