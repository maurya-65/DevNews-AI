/** Deleting an account asks for this phrase to be typed out.
 *
 *  It lives here rather than beside the action because a "use server" file may only
 *  export async functions — a constant exported from one is a build error, not a type
 *  error, so nothing catches it until the page is opened.
 */
export const DELETE_CONFIRM_PHRASE = "delete my account";
