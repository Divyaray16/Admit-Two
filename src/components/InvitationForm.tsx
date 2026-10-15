import type { ChangeEvent } from "react";
import type { FieldErrors, InvitationDraft } from "../types";

type InvitationFormProps = {
  draft: InvitationDraft;
  errors: FieldErrors;
  showErrors: boolean;
  onChange: (patch: Partial<InvitationDraft>) => void;
};

export function InvitationForm({ draft, errors, showErrors, onChange }: InvitationFormProps) {
  return (
    <div className="grid gap-5">
      <Field
        id="sender-name"
        label="Your name"
        value={draft.senderName}
        placeholder="Divya Ray"
        autoComplete="name"
        required
        error={showErrors ? errors.senderName : undefined}
        onChange={(senderName) => onChange({ senderName })}
      />
      <Field
        id="recipient-name"
        label="Their name"
        optional
        value={draft.recipientName}
        placeholder="Maya"
        autoComplete="off"
        error={showErrors ? errors.recipientName : undefined}
        onChange={(recipientName) => onChange({ recipientName })}
      />
      <Field
        id="title"
        label="Invitation title"
        value={draft.title}
        placeholder="movie night, just us two"
        required
        error={showErrors ? errors.title : undefined}
        onChange={(title) => onChange({ title })}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="event-date"
          label="Event date"
          type="date"
          value={draft.eventDate}
          required
          error={showErrors ? errors.eventDate : undefined}
          onChange={(eventDate) => onChange({ eventDate })}
        />
        <Field
          id="event-time"
          label="Event time"
          type="time"
          value={draft.eventTime}
          required
          error={showErrors ? errors.eventTime : undefined}
          onChange={(eventTime) => onChange({ eventTime })}
        />
      </div>
      <Field
        id="location"
        label="Location"
        optional
        value={draft.location}
        placeholder="My place"
        error={showErrors ? errors.location : undefined}
        onChange={(location) => onChange({ location })}
      />
      <Field
        id="message"
        label="Invitation message"
        value={draft.message}
        placeholder="Come over whenever you're ready. I'll save you the good seat."
        required
        multiline
        error={showErrors ? errors.message : undefined}
        onChange={(message) => onChange({ message })}
      />
      <Field
        id="note"
        label="Personal note"
        optional
        value={draft.note}
        placeholder="I'll bring the popcorn."
        multiline
        error={showErrors ? errors.note : undefined}
        onChange={(note) => onChange({ note })}
      />
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  multiline?: boolean;
  autoComplete?: string;
  error?: string;
};

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  optional,
  multiline,
  autoComplete,
  error,
}: FieldProps) {
  const errorId = `${id}-error`;
  const shared = {
    id,
    className: "field",
    value,
    placeholder,
    required,
    autoComplete,
    "aria-invalid": Boolean(error),
    "aria-describedby": error ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value),
  };

  return (
    <div>
      <label className="lbl" htmlFor={id}>
        {label}
        {optional ? <em>optional</em> : null}
      </label>
      {multiline ? <textarea {...shared} rows={3} /> : <input {...shared} type={type} />}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
