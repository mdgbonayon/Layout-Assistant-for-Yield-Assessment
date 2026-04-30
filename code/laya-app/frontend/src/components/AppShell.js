import "../styles/wireframe.css";

function AppShell({ children, leftActions = [], rightActions = [] }) {
  return (
    <div className="wf-page">
      <div className="wf-topbar">
        <div className="wf-topbar-left">
          <div className="wf-brand-wrap">
            <div className="wf-brand">LAYA</div>
            <div className="wf-brand-subtitle">
              Layout Assistant for Yield Assessments
            </div>
          </div>
          {leftActions}
        </div>

        <div className="wf-topbar-right">{rightActions}</div>
      </div>

      <main className="wf-main">{children}</main>
    </div>
  );
}

export default AppShell;