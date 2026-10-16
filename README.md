# AdmitTwo

A personal invitation you can hold. Write a note, record a voice message in the browser, and send a link. The recipient opens a cinema ticket, taps the stub, and hears you.

## Run it

```bash
npm install
npm run dev
```

The app serves at [http://127.0.0.1:4731](http://127.0.0.1:4731).

Without Supabase credentials, the dev server stores each invitation and its recording on disk under `data/invitations`. The share link is the page you are on (`window.location.origin`) plus `/i/` and an unguessable id. Anyone who can open that link can hear the recording and RSVP. The reply is saved on the server, so the sender sees it from Responses.

A quick tunnel in front of this server is temporary. Invitation files stay in `data/` when the dev server restarts, and they disappear if that directory or the machine disk is removed.

## Optional: Supabase

To store invitations in Supabase instead of on this server:

1. Create a Supabase project.
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env` and set:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Restart the dev server. The app uses Supabase and leaves the server store unused.

Use the **anon** key only. Do not put the service role key in the app.

On Vercel, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to **both** the Production and Preview environments, then redeploy. Preview deployments do not receive variables that are scoped to Production only. Vite inlines `VITE_` values when it builds, so a new deployment is required after they change. Without those values, the static site has no `/api/invitations` server and saving fails with that reason. Share links use the address in the browser (`window.location.origin`).

The SQL creates:

- `invitations`, with a hard-to-guess `public_id` and a hashed sender key
- Row level security with no direct table access for anonymous users
- Functions to create an invitation, attach audio, read one invitation, reply, and open the sender view
- A public `invitation-audio` bucket limited to 2 MB

Anyone with the invitation link can open that one invitation and reply. They cannot list other invitations. Sender replies are available from the private sender link or the Responses page on the browser that created them.

If the storage policy fails in the SQL editor, create a public bucket named `invitation-audio` (2 MB limit) and allow anonymous uploads.

## Try the journey

1. Open the app and choose **Create your ticket**. The home page cycles sample tickets from Divya Ray. On the create page, pick a color and type, then fill in the title, date, time, and note.
2. Choose **Tap to record**. Allow the microphone, speak, then stop. Play it back or re-record. There is no file upload. You can also send a ticket without a voice note.
3. Choose **Get my shareable link**. Copy the link. It uses the address in the browser, so a tunnel link opens the same invitation on another device.
4. Open the recipient preview, or open the copied link. If there is a voice note, tap the stub. It tears off at the perforation, drops below the ticket, and the play control on that stub plays the recording. Then RSVP.
5. Accept, or decline and confirm. The reply is saved on the server.
6. Open **Responses** to see the status and the time they answered.

Recording needs a secure page (`localhost` or HTTPS) and a microphone. If permission is blocked, the recorder explains how to try again.

## Walking line

Open [http://127.0.0.1:4731/walk](http://127.0.0.1:4731/walk). The page draws one cream line where this phone has walked in the last seven days. Start asks for location. Pause and End sit under the line. The path stays in this browser (`localStorage`). Nothing is uploaded.

You can pin a picture onto the line while a walk is going, or after it ends. Camera and Photo library both accept an image. The picture is resized on the phone and kept in IndexedDB, not on a server. Tap the mark on the line to see it, add a short caption, or remove it. Photos stay on the phone.

## Scripts

```bash
npm run dev      # local app
npm run build    # typecheck and production build
npm run preview  # serve the production build
npm run lint
```
