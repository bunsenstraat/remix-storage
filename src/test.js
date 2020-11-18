<script src="https://wzrd.in/standalone/buffer"></script>
<script src="https://unpkg.com/ipfs-api@9.0.0/dist/index.js"></script>
<script src="https://unpkg.com/ipfs/dist/index.min.js"></script>


const ipfs = new Ipfs({ repo: 'ipfs-' + Math.random() })
const { Buffer } = Ipfs
ipfs.once('ready', () => {
console.log('Status: ', ipfs.isOnline() ? 'online' : 'offline')
})
function upload() {
const reader = new FileReader();
reader.onloadend = function () {
const buf = buffer.Buffer(reader.result) // Convert data into buffer
ipfs.add(buf, (err, result) => { // Upload buffer to IPFS
  if (err) {
    console.error(err)
    return
  }
  let url = `https://ipfs.io/ipfs/${result[0].hash}`
  console.log(`Url --> ${url}`)
})
}
const photo = document.getElementById("photo");
reader.readAsArrayBuffer(photo.files[0]); 
}

<---HTML--->
<input type="file" name="photo" id="photo">
<button type="button" onclick="upload()">Upload</button>