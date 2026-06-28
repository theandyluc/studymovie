-- TIP-009 — Cải thiện tra từ:
--   (1) thêm cột `source` vào dictionary (phân biệt FVDP nghĩa-VI vs free_dict định-nghĩa-EN cache).
--   (2) lookup_word v2: thêm rule lemmatize sở hữu cách ('s) + so sánh (-er/-est/-ier).
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE. KHÔNG phá dữ liệu FVDP (DEFAULT 'fvdp').

alter table public.dictionary add column if not exists source text not null default 'fvdp';

create or replace function public.lookup_word(p_word text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_word text := lower(btrim(coalesce(p_word, '')));
  v_cands text[];
  v_base text;
  c text;
  v_hit public.dictionary%rowtype;
begin
  if auth.uid() is null and auth.role() <> 'service_role' then
    raise exception 'not authenticated';
  end if;
  if v_word = '' then
    return null;
  end if;

  -- LUÔN thử dạng gốc (exact) TRƯỚC → giữ đúng contraction (it's, don't) đã có trong FVDP.
  v_cands := array[v_word];

  -- Sở hữu cách / apostrophe: dog's -> dog, world's -> world.
  if position('''' in v_word) > 0 then
    v_cands := v_cands || split_part(v_word, '''', 1);
  end if;

  -- Số nhiều / chia động từ (rule cũ).
  if v_word ~ 'ies$' then v_cands := v_cands || (left(v_word, length(v_word) - 3) || 'y'); end if;
  if v_word ~ 'ied$' then v_cands := v_cands || (left(v_word, length(v_word) - 3) || 'y'); end if;
  if v_word ~ 'es$'  then v_cands := v_cands || left(v_word, length(v_word) - 2); end if;
  if v_word ~ 's$'   then v_cands := v_cands || left(v_word, length(v_word) - 1); end if;
  if v_word ~ 'ed$'  then v_cands := v_cands || left(v_word, length(v_word) - 2); end if;
  if v_word ~ 'ing$' then
    v_base := left(v_word, length(v_word) - 3);
    v_cands := v_cands || v_base;
    v_cands := v_cands || (v_base || 'e');
    if length(v_base) >= 2 and right(v_base, 1) = substr(v_base, length(v_base) - 1, 1) then
      v_cands := v_cands || left(v_base, length(v_base) - 1);
    end if;
  end if;

  -- So sánh hơn / nhất: -er / -est (+ -ier->y, + phụ âm đôi bigger->big, + thêm 'e' larger->large).
  if v_word ~ 'iest$' then v_cands := v_cands || (left(v_word, length(v_word) - 4) || 'y'); end if; -- happiest->happy
  if v_word ~ 'ier$'  then v_cands := v_cands || (left(v_word, length(v_word) - 3) || 'y'); end if; -- happier->happy
  if v_word ~ 'est$' then
    v_base := left(v_word, length(v_word) - 3);
    v_cands := v_cands || v_base;             -- tallest->tall
    v_cands := v_cands || (v_base || 'e');    -- largest->large
    if length(v_base) >= 2 and right(v_base, 1) = substr(v_base, length(v_base) - 1, 1) then
      v_cands := v_cands || left(v_base, length(v_base) - 1); -- biggest->big
    end if;
  end if;
  if v_word ~ 'er$' then
    v_base := left(v_word, length(v_word) - 2);
    v_cands := v_cands || v_base;             -- taller->tall
    v_cands := v_cands || (v_base || 'e');    -- larger->large
    if length(v_base) >= 2 and right(v_base, 1) = substr(v_base, length(v_base) - 1, 1) then
      v_cands := v_cands || left(v_base, length(v_base) - 1); -- bigger->big
    end if;
  end if;

  foreach c in array v_cands loop
    select * into v_hit from public.dictionary where lemma = c limit 1;
    if found then
      return jsonb_build_object(
        'lemma', v_hit.lemma,
        'ipa', v_hit.ipa,
        'meanings', v_hit.meanings,
        'audio_url', v_hit.audio_url,
        'source', v_hit.source
      );
    end if;
  end loop;

  return null;
end;
$$;

grant execute on function public.lookup_word(text) to authenticated;
