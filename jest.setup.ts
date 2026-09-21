import '@testing-library/jest-dom';

// Mock next/font/google for Jest: any font (Geist, Fraunces, Figtree, ...) becomes a harmless stub
jest.mock('next/font/google', () =>
    new Proxy(
        {},
        {
            get: (_target, prop) =>
                prop === '__esModule' ? true : () => ({ variable: 'mock-font-var', className: 'mock-font' }),
        }
    )
);
