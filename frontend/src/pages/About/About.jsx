import { Link } from 'react-router-dom';
import './About.css';

const About = () => {
  return (
    <div className="about-page">
      <div className="about-container">
        <header className="about-header">
          <h1 className="about-title">About SikshaSetu</h1>
          <p className="about-subtitle">
            Democratizing personalized education through agentic AI and native-language instruction.
          </p>
        </header>

        <section className="about-content">
          <div className="about-block">
            <h2>The Vision</h2>
            <p>
              "Siksha" (Education) and "Setu" (Bridge) represents our mission: to bridge the gap
              between students and high-quality, personalized mentorship. No two students learn the
              exact same way. SikshaSetu is built to ensure every student has access to an AI tutor
              that understands their individual needs, memory, and native language.
            </p>
          </div>

          <div className="about-block">
            <h2>Core Pillars</h2>
            <ul>
              <li>
                <strong>AI Learning Companion:</strong> Patient, conversational guidance that turns passive reading into active inquiry.
              </li>
              <li>
                <strong>Personalized Roadmaps:</strong> Step-by-step milestones adapted to current mastery.
              </li>
              <li>
                <strong>Multilingual Accessibility:</strong> Seamless instruction in Hindi, Odia, Bengali, Tamil, Telugu, Marathi, and English.
              </li>
              <li>
                <strong>Privacy & Security:</strong> Robust JWT session security, encrypted credential storage, and private learner state.
              </li>
            </ul>
          </div>

          <div className="about-cta">
            <Link to="/sign-up" className="btn btn-primary btn-lg">
              Start Your Learning Journey
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
