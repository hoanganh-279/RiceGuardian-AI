export function MasterDetailLayout({ master, detail }) {
  return (
    <div className="rg-md">
      <aside className="rg-md-card rg-md-master">{master}</aside>
      <section className="rg-md-card rg-md-detail">{detail}</section>
    </div>
  )
}
