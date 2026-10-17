export const LABELS = ["billing", "bug", "feature_request", "other"];

// v1: the short first version.
const v1 = `Classify the customer support message into one of these categories: billing, bug, feature_request, other.
Answer with the category name only.`;

// v2: a candidate second version, with definitions and a rule. Edit it before you run it if you want
// (write down what you changed in solution.md).
const v2 = `Classify the customer support message into exactly one category.

billing: charges, refunds, payments, subscriptions, or the content of an invoice.
bug: something that is broken, crashes, or shows an error, even if it happens on a billing page.
feature_request: the customer asks for something that does not exist yet.
other: anything else, including thanks and general questions.

Answer with the category name only, in lower case.`;

export const PROMPTS = { v1, v2 };
