// スマホ用ページの設定。ここに書く値はすべて公開してよいもの（秘密キーは絶対に書かない）
window.MYCOVER = {
  supabaseUrl: "https://hasykewktdnsqgrnzgij.supabase.co",
  publishableKey: "sb_publishable_tV56DfmPw7fX5CfcCKNEyA_1yI9Dxwm", // 公開キー（RLS で保護）
  track: {
    title: "B7F",
    artist: "Usagi Ikeda",
    format: "配信シングル",
    mp3: "B7F.mp3", // TODO: 楽曲MP3をこのページと同じ場所に B7F.mp3 という名前で置く
  },
  jacketDigits: 4,
  cardDigits: 4,

  // 特設エリア。公開日を過ぎると自動で切り替わる。展示PCの config/config.json の release と同じ日付にする
  release: {
    officialJacketAt: "2026-12-16T00:00:00+09:00", // 公式ジャケット公開日時（作者決定：12/16。時刻は未指定のため 0:00）
    mvAt: "2026-12-16T00:00:00+09:00", // MV 公開日時（作者決定：12/16）
    officialJacketImage: "official.jpg", // 公式ジャケット画像（このページと同じ場所に置く）
    mvUrl: "", // TODO: MV の YouTube の URL
  },

  // 作品ページ（URL に ?t= や ?c= が付いていないとき）と特設エリアの文章。改行は \n
  work: {
    catch: "この一曲を、\nあなただけの一枚に。",
    intro: "『My Cover』は、同じ一曲を聴いた人それぞれの言葉から、その人だけのジャケットが生まれる作品です。\n展示会場で「B7F」を聴き、浮かんだ色や景色、気持ちを言葉にすると、世界に一つだけのオリジナルジャケットができあがります。",
    songIntro: "東京の地下深く、まだ見ぬ誰かの存在を信じる。\nB7F。毎日だれかが降りてきては、それぞれの穴へ散っていく。東京を横から切って眺めたら、自分の居場所なんて小さな点だ。けれど、その点のすぐ隣、壁一枚向こうで、似た寂しさを抱えた誰かが息をしているのかもしれない。", // TODO: 曲「B7F」の紹介文（空のあいだは「B7F について」の欄を出さない）
  },
  gallery: {
    shelf: 12, // 持ち帰りページの「みんなの My Cover」に横に並べる枚数
    page: 30, // 作品ページで一度に読み込む枚数（「もっと見る」で続きを読む）
  },

  authorUrl: "", // 作者HP の URL（空のあいだは出さない。入れると作品ページのクレジットにリンクが付く）
  exhibition: [
    "デザイン情報学科３年ゼミ展",
    "2026.12.3-12.5 / 9:00~18:00（最終日 ~16:30）",
    "武蔵野美術大学 鷹の台キャンパス９号館地下",
    "『My Cover』池田うさぎ（大石ゼミ）",
  ],
};
