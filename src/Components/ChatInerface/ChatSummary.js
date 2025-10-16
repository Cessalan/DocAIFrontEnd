import "./SummaryDisplay.css";

const SummaryDisplay = ({ summary }) => {
  return (
    <div className="summary-container">
      <h3 className="summary-title">{summary.title}</h3>
      {summary.sections.map((section, i) => (
        <div key={i} className="summary-section">
          <h4>{section.heading}</h4>
          <ul>
            {section.bullets.map((point, j) => (
              <li key={j}>{point}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default SummaryDisplay;
