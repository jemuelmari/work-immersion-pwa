# Work Immersion PWA

Offline-first na attendance (DTR), diary, at requirements tracker para sa Work Immersion.
React + Vite + Tailwind, Supabase (database, auth, storage), naka-deploy sa Vercel.

## Pag-deploy ng update na ito (security fix, Nov 2026)

Gawin nang **magkasunod**, sa oras na kaunti ang gumagamit:

1. **Supabase → SQL Editor → New query.** I-paste ang buong
   `supabase/migrations/20261116_security_fixes.sql` at i-Run.
   Kapag may error, walang mababago; ipadala ang error message.
2. **I-push ang code sa GitHub** → kusang magde-deploy ang Vercel.
3. **(Optional) Vercel → Settings → Environment Variables:**
   `VITE_SUPABASE_URL` at `VITE_SUPABASE_ANON_KEY` (tingnan ang `.env.example`).
   May fallback sa code kaya gagana kahit hindi pa ito naka-set.
4. Sa SQL Editor, i-run ang mga query sa **dulo ng SQL file** (A, B, C) para makita
   kung may teacher o estudyanteng hindi dapat na-approve.
5. Siguraduhing **naka-OFF ang "Confirm email"** (Authentication → Providers → Email),
   dahil hindi nakakatanggap ng email ang `@student.local`.

## Paano gumagana ngayon

| Bahagi | Paano |
|---|---|
| Registration | `supabase.auth.signUp` lang. Ang database trigger ang gumagawa ng `students`/`teachers` row, laging **Pending**. |
| Login | Hindi makakapasok ang Pending o Rejected. |
| Time in/out | Naka-save muna sa device (IndexedDB), tapos kusang ipinapadala sa `record_attendance()`. Hindi na mapapalitan ang oras kapag naipadala na. |
| Litrato at files | Private ang lahat ng bucket. Path ang sine-save; signed link (1 oras) kapag binubuksan. |
| Forgot password | `request_password_reset()` → teacher → `reset_student_password()` (binabago ang totoong login password). |
| Diary | Hindi kayang galawin ng estudyante ang grade, feedback, o lock. |
| Teacher approval | Admin lang ang nakakakita at nakaka-approve ng ibang teacher. |

## Development

```bash
npm install
npm run dev
npm run typecheck   # TypeScript check
npm run build
```
