// Public surface of the counselling module (Career Diya counsellor platform, ADR-015).
// Other code imports from here only (invariant A1).
export * from './domain/types';
export * from './domain/rules';
export * from './application/queries';
export * from './application/commands';
export { razorpayConfig, createRazorpayOrder } from './application/razorpay';
export type { RazorpayConfig, RazorpayOrder } from './application/razorpay';
export { CERTIFICATE_BUCKET, REPORT_BUCKET } from './application/db';
