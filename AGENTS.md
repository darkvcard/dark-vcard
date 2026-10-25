<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Payment architecture
- Use authenticated TanStack server functions for invoice creation and managed authenticated HTTP schedules for verification; this app runs on Workers, not Supabase Edge Functions.
- Store immutable invoices and private per-card fulfillment units separately from public products; only service-role functions can allocate amounts or fulfill orders atomically.
- Verify canonical USDT transfers against finalized blockchain evidence and enforce globally unique transaction references in the database; client payment claims cannot complete orders.
- Provider credentials are optional environment references, never fake values; disabled providers prevent new invoices on that network.
