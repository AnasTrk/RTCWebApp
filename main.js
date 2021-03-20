import './style.css'

import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBIdLaefZSejWp1uDu1eahHgtHM4Mj8MVw",
  authDomain: "rtc-webapp-8bbee.firebaseapp.com",
  projectId: "rtc-webapp-8bbee",
  storageBucket: "rtc-webapp-8bbee.appspot.com",
  messagingSenderId: "412903889117",
  appId: "1:412903889117:web:9121c66e7cd31eb53fe334",
  measurementId: "G-YN6JLHWXGR"
};
firebase.initializeApp(firebaseConfig);
const firestore = firebase.firestore();
//ice 
  const servers={
      iceServers:[
          {
            urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302','stun:stun2.l.google.com:19302']
          },
      ]
  }
  //Global State ==> (InitPeer)
  let pc = new RTCPeerConnection(servers);
  let localStream =  null;
  let remoteStream = null;

  const webcamButton =  document.querySelector('#webcamButton');
  const webcamVideo =  document.querySelector('#webcamVideo');
  const recieverVideo =  document.querySelector('#reciever');
  const callButton =  document.querySelector('#callButton');
  const answerButton =  document.querySelector('#answerButton');
  const callInput = document.querySelector('#callInput');
  //ask for camera & audio from the navigator.. asidi
  webcamButton.onclick = async ()=>{
    localStream = await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    remoteStream = new MediaStream();
    localStream.getTracks().forEach((track)=>{
      pc.addTrack(track,localStream);
    });
   }
   //send all the tracks to the peer connection & recieiving them on the other side ...
   pc.ontrack =  (event) =>{
    event.streams[0].getTracks().forEach((track)=>{
      remoteStream.addTrack(track);
    });
   }
   //show the stream
   webcamVideo.srcObject= localStream;
   recieverVideo.srcObject =remoteStream;
   //MAKE THE OFFER TO A RECIEVER
   callButton.onclick = async ()=>{
    const callDoc = firestore.collection('calls').doc();
    const offerCandidates = callDoc.collection('offerCandidates');
    const answerCandidates = callDoc.collection('answerCandidates');
    callInput.value = callDoc.id;

    //generate ice candadites
    pc.onicecandidate = event =>{
      event.candidate && offerCandidates.add(event.candidate.toJSON());
    };
    //PC CREATING OFFER ...
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);
    const offer = {
      sdp: offerDescription.sdp,
      type : offerDescription.type,
    };

    await callDoc.set({offer});
    callDoc.onSnapshot((snapshot)=>{
      const data = snapshot.data();
      if(!pc.currentRemoteDescription && data.answer)
        {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.setRemoteDescription(answerDescription);
        }
    });
    answerCandidates.onSnapshot(snapshot =>{
      snapshot.docChanges().forEach((change)=>{
        if(change.type === 'added'){
          const candadite = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candadite);
        }
      })
    });
   }
  answerButton.onclick=async ()=>{
  const callId = callInput.value;
  const callDoc = firestore.collection('calls').doc('callId');
  pc.onicecandidate = (event) =>{
    event.candadite && answerCandidates.add(event.candidate.toJSON());
  };
  const callData = (await callDoc.get()).data();
  const offerDescription = callData.offer;
  await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));
  const answer ={
    sdp: answerDescription.sdp,
    type : answerDescription.type,
  };
  await  callDoc.update({ answer });
  offerCandidates.onSnapshot((snapshot)=>{
    snapshot.docChanges().forEach((change)=>{
      console.log(change);
      if(change.type === 'added'){
        let data = change.doc.data();
        pc.addIceCandidate(new RTCIceCandidate(data));
      }
    });
  });
};