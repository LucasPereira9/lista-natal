-- Lista inicial da família (gerado por scripts/gerar-seed.mjs)
-- Rode DEPOIS do schema.sql

insert into public.people (name, note) values
  ('Cecília', null),
  ('Patrik', 'Ou o que meu amigo achar que eu mereço 😉'),
  ('Marina', 'Calçado não posso por causa da cirurgia'),
  ('Priscila', null),
  ('Duda', null),
  ('Victor', null),
  ('Luiza', null),
  ('Davi', null),
  ('Aline', null),
  ('Marlene', 'Me surpreenda — só não quero nada pra casa!'),
  ('Letícia', null),
  ('Bruno', 'Ou seja criativo e me surpreenda rsrs 😘'),
  ('Débora', null)
on conflict do nothing;

insert into public.items (person_id, title, details)
select p.id, v.title, v.details
from (values
  ('Cecília', 'Roupa', 'Tamanho G1'),
  ('Cecília', 'Calçado', 'Número 39'),
  ('Patrik', 'Blusa', 'Tamanho M'),
  ('Patrik', 'Chinelo', '39/40'),
  ('Patrik', 'Tênis', '39/40'),
  ('Patrik', 'Bermuda', '36/38'),
  ('Patrik', 'Calça', '36/38'),
  ('Marina', 'Roupa', 'Tamanho P'),
  ('Marina', 'Caderno inteligente', 'Amooooooo 🥰'),
  ('Marina', 'Agenda personalizada', null),
  ('Priscila', 'Roupa', 'Tamanho GG'),
  ('Priscila', 'Calçado', 'Número 40'),
  ('Duda', 'Roupa bonita', 'Tamanho GG'),
  ('Duda', 'Sandália bonita', 'Número 40'),
  ('Victor', 'Camisa', 'Tamanho XG'),
  ('Victor', 'Short malha esportiva', 'Preto, XG'),
  ('Victor', 'Kit meia branca cano alto', null),
  ('Luiza', 'Perfume', null),
  ('Luiza', 'Body splash', null),
  ('Davi', 'Carrinho de controle remoto de drift', null),
  ('Aline', 'Roupa bem bonita', null),
  ('Aline', 'Perfume', null),
  ('Aline', 'Sapato', null),
  ('Letícia', 'Perfume', null),
  ('Letícia', 'Calça jeans cargo', 'Tamanho 42'),
  ('Letícia', 'Tênis', 'Número 38'),
  ('Bruno', 'Sapato ou chinelo', '39/40'),
  ('Bruno', 'Bermuda', 'Tamanho 40'),
  ('Bruno', 'Blusa', 'Tamanho M'),
  ('Bruno', 'Perfume', null),
  ('Débora', 'Tênis', '37/38 — preto, branco ou marrom'),
  ('Débora', 'Perfume', 'Nada doce, chocolate ou frutal'),
  ('Débora', 'Brincos grandes', null),
  ('Débora', 'Anéis', null),
  ('Débora', 'Roupa de frio', null),
  ('Débora', 'Biquíni', 'Cores vibrantes')
) as v(person, title, details)
join public.people p on lower(p.name) = lower(v.person);
