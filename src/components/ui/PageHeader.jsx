export default function PageHeader({ title, description, eyebrow, actions, children }) {
  return (
    <header className="ds-page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-xs font-semibold text-[var(--color-primary)]">{eyebrow}</p> : null}
        <h1 className="ds-page-title">{title}</h1>
        {description ? <p className="ds-page-description">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
    </header>
  );
}
