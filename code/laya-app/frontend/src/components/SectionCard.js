function SectionCard({ title, children }) {
  return (
    <section className="wf-card">
      <h2 className="wf-card-title">{title}</h2>
      <hr className="wf-divider" />
      {children}
    </section>
  );
}

export default SectionCard;