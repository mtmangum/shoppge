// Shared Tailwind class strings for the "filter bar" family of forms
// (label stacked above a single-line input/select, laid out in an
// items-end flex/grid row): the jobs filter bar, activity log filters,
// the create-user form, and the access-request approval form.
//
// Deliberately NOT used by components/jobs/JobActions.tsx or
// components/admin/users/UsersManager.tsx, which use a smaller, denser
// control scale for their own narrower/inline contexts, or by the
// new-job form's textareas and item-list/billing grids, which mix
// textareas (an explicit height here would clip them) with a different
// compact scale — those aren't the same pattern, just a similar one.

export const FIELD_CLASS = 'block h-10 w-full min-w-0 appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#BF5700]'

export const LABEL_CLASS = 'mb-1 block text-xs font-medium leading-4 text-gray-600'

export const SELECT_CHEVRON_CLASS = 'pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500'
