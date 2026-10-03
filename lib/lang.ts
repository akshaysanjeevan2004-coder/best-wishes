/* eslint-disable @typescript-eslint/no-explicit-any */
export type Lang = 'en' | 'hi';
export const asLang = (v: unknown): Lang => (v === 'hi' ? 'hi' : 'en');
export const HI_FIELDS = 'question_text_hi,option_a_hi,option_b_hi,option_c_hi,option_d_hi,image_path_hi,image_whole_hi';

/** The question as the candidate sees it, in the language they chose. */
export function view(q: Record<string, any>, lang: Lang) {
  if (lang === 'hi') {
    const imagePath: string | null = q.image_path_hi ?? null;
    return {
      text: (q.question_text_hi ?? '') as string,
      options: [q.option_a_hi, q.option_b_hi, q.option_c_hi, q.option_d_hi].map((o) => (o ?? '') as string),
      imagePath, whole: !!imagePath && q.image_whole_hi !== false,
    };
  }
  const imagePath: string | null = q.image_path ?? null;
  return {
    text: q.question_text as string,
    options: [q.option_a, q.option_b, q.option_c, q.option_d] as string[],
    imagePath, whole: !!imagePath && q.image_whole !== false,
  };
}

/** A Hindi question is usable if it has full Hindi text + 4 options, OR a whole-question screenshot. */
export function hindiComplete(q: Record<string, any>): boolean {
  const v = view(q, 'hi');
  const textOk = !!v.text.trim() && v.options.every((o) => !!o.trim());
  return textOk || (!!v.imagePath && v.whole);
}
