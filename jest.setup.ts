import '@testing-library/jest-dom'

// React 19 concurrent mode requires IS_REACT_ACT_ENVIRONMENT = true
// so that createRoot flushes work synchronously inside act() during tests.
// Without this, render() calls produce empty output.
// See: https://react.dev/warnings/not-wrapped-in-act
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
