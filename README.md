# AdmitTwo

A personal invitation you can hold. Write a note, record a voice message in the browser, and send a link. The recipient opens a cinema ticket, taps the stub, and hears you.

## Run it

```bash
npm install
npm run dev
```

The app serves at [http://127.0.0.1:4731](http://127.0.0.1:4731).

Without Supabase credentials it runs in **demo mode**. Invitations, recordings, and replies stay in this browser. Demo links are not public.

## Make a real invitation

1. Create a Supabase project.
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env` and set:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

4. Restart the dev server. The corner chip changes from “Demo · this browser” to “Live”.

Use the **anon** key only. Do not put the service role key in the app.

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
3. Choose **Get my shareable link**. Copy the link. In demo mode it only opens in this browser.
4. Open the recipient preview. If there is a voice note, tap the stub. It tears off at the perforation, drops below the ticket, and the play control on that stub plays the recording. Then RSVP.
5. Accept, or decline and confirm. The reply is saved.
6. Open **Responses** to see the status and the time they answered.

In demo mode, do step 4 in the same browser. The share screen says the link is not public.

Recording needs a secure page (`localhost` or HTTPS) and a microphone. If permission is blocked, the recorder explains how to try again.

## Scripts

```bash
npm run dev      # local app
npm run build    # typecheck and production build
npm run preview  # serve the production build
npm run lint
```
