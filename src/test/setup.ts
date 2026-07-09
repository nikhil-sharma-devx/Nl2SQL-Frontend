// Vitest global setup — extends expect with jest-dom matchers. Item 19.
// (@testing-library/react is intentionally NOT imported here: its required
// peer @testing-library/dom is not installed, so tests render via react-dom
// directly. The flag below tells React we're inside an act() test scope.)
import '@testing-library/jest-dom/vitest'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
