type PlaceholderPageProps = {
  title: string
  description: string
  notes?: string[]
}

/** Temporary screen used until the assigned developer implements the real UI. */
export function PlaceholderPage({
  title,
  description,
  notes = [],
}: PlaceholderPageProps) {
  return (
    <section className="placeholder">
      <p className="eyebrow">Starter screen</p>
      <h1>{title}</h1>
      <p className="lede">{description}</p>
      {notes.length > 0 ? (
        <ul>
          {notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
