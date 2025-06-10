WordArr1 = [
  "まあ、",
  "あ、",
  "んー、",
  "マジか、",
  "やば、",
  "ごめんね。",
  "うわーー、",
  "え？",
  "どゆこと？？",
  "最悪、",
  "うげー！",
  "誰にも言わないでね。",
  "こら！",
  "なんでやねん！",
  "イヤッ!",
  "ねえねえ",
  "決めた。",
  "正直",
  "これ、聞いた話なんだけどさ。",
  "知ってる？",
]

WordArr2 = [
  "私",
  "アタシ",
  "君",
  "俺",
  "アイツ",
  "みんな",
  "お前",
  "神様",
  "佐川さん",
  "和田ちゃん",
  "中村さん",
  "いとけん",
  "秦名ちゃん",
  "なっちゃん",
  "あかりん",
  "先生",
  "お母さん",
  "お前のおばあちゃん",
  "前澤さん",
  "オジサン",
  "ガンダム",
]

WordArr3 = [
  "の墓に入りたい",
  "の家ここに建てない？",
  "LOVE",
  "なんか臭くない?",
  "壊れちゃった・・・",
  "虚無〜",
  "できない！！！！",
  "今日はもう寝る",
  "100%無理",
  "こわ...",
  "もういいや...",
  "ずるいよ",
  "マジリスペクト",
  "今日遊べる？",
  "足速いよね",
  "お腹すいてるのかな",
  "大好き",
  "かなしい。。",
  "すごいよね",
  "めんどい",
  "どこ？",
  "だめかな…？",
  "やばいよ",
  "嘘つきじゃん！",
  "いいやつかよ",
  "かっこいいよね...",
  "かわいいよね...",
  "意味不明",
  "仲良くしてよ!",
  "になりたい。",
  "マジ無理",
  "きっつ"
]

WordArr4 = [
  "!!!",
  "❤️",
  "😀",
  "😂",
  "😍",
  "😘",
  "😇",
  "😡",
  "😱",
  "😥",
  "www"
]

let isNextBalloonLeft = true; // 次の吹き出しを左に表示するかどうか

function getRandomWord(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function displayRandomWords() {
    const word1 = getRandomWord(WordArr1);
    const word2 = getRandomWord(WordArr2);
    const word3 = getRandomWord(WordArr3);
    const word4 = getRandomWord(WordArr4);
    const combinedWords = word1 + word2 + word3 + (Math.random() < 0.5 ? word4 : "");

    const chatArea = document.getElementById("chat-area");

    const balloonDiv = document.createElement("div");
    balloonDiv.className = "balloon";

    if (isNextBalloonLeft) {
        balloonDiv.classList.add("left");
    } else {
        balloonDiv.classList.add("right");
        // 右寄せの場合、吹き出しの色を変えるなどしても良い
        // balloonDiv.style.backgroundColor = "#e0ffe0"; 
    }
    isNextBalloonLeft = !isNextBalloonLeft; // 次回は反対側に

    const wordP = document.createElement("p");
    wordP.textContent = combinedWords;

    balloonDiv.appendChild(wordP);
    chatArea.appendChild(balloonDiv);

    chatArea.scrollTop = chatArea.scrollHeight;
}

window.onload = function() {
    const chatArea = document.getElementById("chat-area");
    if (!chatArea) {
        console.error("Error: chat-area element not found.");
        return;
    }
    displayRandomWords(); // ページロード時にまず1つ表示
    setInterval(displayRandomWords, 3000); // 3秒ごとに関数を呼び出す
};


