/**
 * Xay dung bieu thuc chinh quy (Regex Pattern) giup tim kiem tieng Viet co dau hoac khong dau
 * Ho tro ca tieng Viet, tieng Anh va ky tu dac biet
 */
export function buildVietnameseRegex(query?: string): RegExp {
  if (!query || !query.trim()) {
    return /.*/i;
  }

  const escapeRegex = (s: string) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

  const charMap: Record<string, string> = {
    a: '[aàáạảãâầấậẩẫăằắặẳẵAÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴ]',
    e: '[eèéẹẻẽêềếệểễEÈÉẸẺẼÊỀẾỆỂỄ]',
    i: '[iìíịỉĩIÌÍỊỈĨ]',
    o: '[oòóọỏõôồốộổỗơờớợởỡOÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠ]',
    u: '[uùúụủũưừứựửữUÙÚỤỦŨƯỪỨỰỬỮ]',
    y: '[yỳýỵỷỹYỲÝỴỶỸ]',
    d: '[dđDĐ]',
  };

  const clean = query.trim().toLowerCase();
  let pattern = '';

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (charMap[ch]) {
      pattern += charMap[ch];
    } else if (/\s/.test(ch)) {
      pattern += '\\s+';
    } else {
      pattern += escapeRegex(ch);
    }
  }

  try {
    return new RegExp(pattern, 'i');
  } catch {
    return new RegExp(escapeRegex(query.trim()), 'i');
  }
}
