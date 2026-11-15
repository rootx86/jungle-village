const NAMES = `Naruto Uzumaki|Sasuke Uchiha|Sakura Haruno|Kakashi Hatake|Hinata Hyuga|Itachi Uchiha|Gaara|Rock Lee|Tsunade|Jiraiya|Monkey D. Luffy|Roronoa Zoro|Nami|Usopp|Sanji|Tony Tony Chopper|Nico Robin|Franky|Brook|Portgas D. Ace|Son Goku|Vegeta|Gohan|Piccolo|Bulma|Krillin|Trunks|Frieza|Ichigo Kurosaki|Rukia Kuchiki|Orihime Inoue|Byakuya Kuchiki|Edward Elric|Alphonse Elric|Winry Rockbell|Roy Mustang|Riza Hawkeye|Eren Yeager|Mikasa Ackerman|Armin Arlert|Levi Ackerman|Erwin Smith|Historia Reiss|Light Yagami|L Lawliet|Misa Amane|Ryuk|Tanjiro Kamado|Nezuko Kamado|Zenitsu Agatsuma|Inosuke Hashibira|Giyu Tomioka|Shinobu Kocho|Kyojuro Rengoku|Izuku Midoriya|Katsuki Bakugo|Ochaco Uraraka|Shoto Todoroki|All Might|Tenya Iida|Yuji Itadori|Megumi Fushiguro|Nobara Kugisaki|Satoru Gojo|Gon Freecss|Killua Zoldyck|Kurapika|Leorio Paradinight|Hisoka Morow|Spike Spiegel|Faye Valentine|Jet Black|Lelouch Lamperouge|Suzaku Kururugi|C.C.|Kallen Kozuki|Shinji Ikari|Rei Ayanami|Asuka Langley|Misato Katsuragi|Kaneki Ken|Touka Kirishima|Saitama|Genos|Mob|Reigen Arataka|Violet Evergarden|Frieren|Fern|Stark|Himmel|Anya Forger|Loid Forger|Yor Forger|Denji|Power|Makima|Aki Hayakawa|Asta|Yuno|Noelle Silva|Yami Sukehiro|Natsu Dragneel|Lucy Heartfilia|Erza Scarlet|Gray Fullbuster|Happy|Meliodas|Elizabeth Liones|Ban|Kirito|Asuna Yuuki|Sinon|Subaru Natsuki|Emilia|Rem|Ram|Megumin|Kazuma Satou|Aqua|Darkness|Rimuru Tempest|Ainz Ooal Gown|Albedo|Senku Ishigami|Taiju Oki|Chrome|Tohru Honda|Kyo Sohma|Yuki Sohma|Usagi Tsukino|Tuxedo Mask|Totoro|Kiki|San|Ashitaka|Chihiro Ogino|Haku|Howl Jenkins|Sophie Hatter|Nausicaa|Sosuke|Ponyo|Shoyo Hinata|Tobio Kageyama|Kei Tsukishima|Rin Okumura|Yukio Okumura|Maki Zenin|Toga Himiko|Rukawa Kaede|Hanamichi Sakuragi|Lupin the Third|Jotaro Kujo|Dio Brando|Josuke Higashikata|Giorno Giovanna|Jolyne Cujoh|Bocchi Hitori|Nijika Ijichi|Ryo Yamada|Kikuri Hiroi|Marin Kitagawa|Sono Bisque|Kaguya Shinomiya|Miyuki Shirogane|Chika Fujiwara|Mitsuha Miyamizu|Taki Tachibana|Shouya Ishida|Shouko Nishimiya|Takumi Fujiwara|Okabe Rintaro|Kurisu Makise|Mayuri Shiina|Yuuki Konno`;
export const ANIME_NAMES: string[] = NAMES.split('|');

/** Pick a random name that is not in `used`. When the list is exhausted, append roman numerals. */
export function pickName(used: Set<string>, rng: () => number = Math.random): string {
  const free = ANIME_NAMES.filter((n) => !used.has(n));
  if (free.length) return free[Math.floor(rng() * free.length)];
  const roman = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  for (let round = 0; ; round++) {
    const suffix = round < roman.length ? roman[round] : String(round + 2);
    const f = ANIME_NAMES.filter((n) => !used.has(`${n} ${suffix}`));
    if (f.length) return `${f[Math.floor(rng() * f.length)]} ${suffix}`;
  }
}
