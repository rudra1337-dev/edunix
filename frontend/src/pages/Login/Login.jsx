import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const validate = () => {
    const errors = {};
    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    }
    return errors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (submitError) {
      setSubmitError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      await login({
        email: formData.email.trim(),
        password: formData.password,
      });

      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err) {
      setSubmitError(
        err.message || 'Unable to log in. Please check your credentials and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo-badge">
            <span>📚</span>
          </div>
          <h1 className="auth-card__title">Welcome Back</h1>
          <p className="auth-card__subtitle">
            Sign in to your Edunix personalized learning journey
          </p>
        </div>

        {submitError && (
          <div className="auth-alert auth-alert--error" role="alert">
            <span className="auth-alert__icon">⚠️</span>
            <p className="auth-alert__message">{submitError}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              autoFocus
              disabled={isSubmitting}
              value={formData.email}
              onChange={handleChange}
              placeholder="student@example.com"
              className={`form-input ${fieldErrors.email ? 'form-input--error' : ''}`}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <span id="email-error" className="form-error">
                {fieldErrors.email}
              </span>
            )}
          </div>

          <div className="form-group">
            <div className="form-label-row">
              <label htmlFor="login-password" className="form-label">
                Password
              </label>
            </div>
            <div className="password-input-wrapper">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                disabled={isSubmitting}
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                className={`form-input ${fieldErrors.password ? 'form-input--error' : ''}`}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="password-toggle-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={0}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {fieldErrors.password && (
              <span id="password-error" className="form-error">
                {fieldErrors.password}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="auth-submit-btn"
          >
            {isSubmitting ? (
              <span className="btn-spinner-wrapper">
                <span className="btn-spinner" />
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="auth-card__footer">
          <p>
            Don't have an account?{' '}
            <Link to="/sign-up" className="auth-link">
              Create student account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
