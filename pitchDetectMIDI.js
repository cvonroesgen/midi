/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

var chords = [
        {name:"CMaj7", notes:{"C":true, "E":true, "G":true, "B":true}},
        {name:"FMaj7", notes:{"F":true, "A":true, "C":true, "E":true}},
        {name:"F", notes:{"F":true, "A":true, "C":true, "Eb":true}},
        {name:"G7", notes:{"G":true, "B":true, "D":true, "F":true}},
        {name:"G13", notes:{"G":true, "B":true, "D":true, "F":true, "A":true, "C":true, "E":true}},
        {name:"C9", notes:{"C":true, "E":true, "G":true, "Bb":true, "D":true}},
        {name:"C#Dim", notes:{"Db":true, "E":true, "G":true}},
        {name:"E7", notes:{"E":true, "Ab":true, "B":true, "D":true}},
        {name:"A7", notes:{"A":true, "G":true, "B":true, "Db":true}},
        {name:"D7", notes:{"D":true, "Gb":true, "A":true, "C":true}}
];

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var audioContext = null;

var theBuffer = null;
var canvas = null;
var mediaStreamSource = null;
var detectorElem, 
	waveCanvas,
	pitchElem,
	noteElem,
	detuneElem,
	detuneAmount,
    correlationDiv,
    displayStaff = false,
    displayChords = true,
    displayWaveform = false,
    minPitch = 90,
    maxPitch = 2218,
    millisecondsPauseThreshold = 100,    
    minOffset,
    maxOffset,
    waitForPause = 0,
    playedNoteString,
    noteNumber;

window.onload = function() {
    MIDI.loadPlugin({
		soundfontUrl: "./soundfont/",
		instrument: "acoustic_grand_piano",
        audioFormat:"ogg",
		onprogress: function(state, progress) {
			console.log(state, progress);
		},
		onsuccess: function() {
			var delay = 0; // play one note every quarter second
			var note = 52; // the MIDI note
			var velocity = 127; // how hard the note hits
			// play the note
			MIDI.setVolume(0, 127);
			MIDI.noteOn(0, note, velocity, delay);
      
			MIDI.noteOff(0, note, delay + 2.75);
		}
	});
	audioContext = new AudioContext();
    minOffset = Math.floor(audioContext.sampleRate/maxPitch);
    maxOffset = Math.ceil(audioContext.sampleRate/minPitch);
	detectorElem = document.getElementById( "detector" );
	canvas = document.getElementById( "canvas" );
    correlationDiv = document.getElementById( "correlation" );
	if (canvas) {
		waveCanvas = canvas.getContext("2d");
		waveCanvas.strokeStyle = "black";
		waveCanvas.lineWidth = 1;
	}
	pitchElem = document.getElementById( "pitch" );
	noteElem = document.getElementById( "note" );
	detuneElem = document.getElementById( "detune" );
	detuneAmount = document.getElementById( "detune_amt" );
    var jChordTable = $("#chordtable");
    var jHeaderRow = $("<tr>");
    jChordTable.append(jHeaderRow);
    for(var j = 0; j < chords.length; j++)
        {
        jHeaderRow.append($("<td>").text(chords[j].name));
        }
    for(var i = 0; i < noteStrings.length; i++)
        {
        jRow = $("<tr>");
        jChordTable.append(jRow);
        for(var j = 0; j < chords.length; j++)
            {
            var jCell = $("<td>").text(noteStrings[i]);
            if(chords[j].notes[noteStrings[i]])
                {
                jCell.attr("good", "1");
                }
            jCell.attr("note", noteStrings[i]);
            jRow.append(jCell);
            }
        }
    $("input[type=radio]")
        .change(
            function(e)
                {
                if($("#staff").is(":checked"))
                    {
                    displayStaff = true;
                    displayChords = false;
                    displayWaveform = false;
                    $("#canvas").show();
                    $("#chordtable").hide();
                    }
                if($("#chords").is(":checked"))
                    {
                    displayChords = true;
                    displayStaff = false;
                    displayWaveform = false;
                    $("#canvas").hide();
                    $("#chordtable").show();
                    }
                if($("#waveform").is(":checked"))
                    {
                    displayChords = false;
                    displayStaff = false;
                    displayWaveform = true;
                    $("#canvas").show();
                    $("#chordtable").hide();
                    }
                }
            );
    $("#chords").trigger("change");
    getUserMedia(
    	{
            "audio": {
                "mandatory": {
                    "googEchoCancellation": "false",
                    "googAutoGainControl": "false",
                    "googNoiseSuppression": "false",
                    "googHighpassFilter": "false"
                },
                "optional": []
            },
        }, gotStream);
    $("#tone")
        .click(function()
            {
            if(noteNumber == undefined)
                {
                noteNumber = Math.floor(Math.random() * 12) + 57;
                }
            playedNoteString = undefined;
            var noteLetter = noteStrings[noteNumber%12];
            var duration = parseFloat($("#duration").val());
            if(isNaN(duration))
                {
                duration = 1;
                }
            //MIDI.noteOn(0, noteNumber, 127, 0);      
			//MIDI.noteOff(0, noteNumber, 0 + 9.75);
            playTone(frequencyFromNoteNumber(noteNumber), 0, duration);
            $("#playednote").text(noteLetter + "/" + Math.floor(noteNumber/12));
            window.setTimeout(function(){playedNoteString = noteLetter + "/" + Math.floor(noteNumber/12);}, duration <= 1 ? 2000 * duration : 10 );
            }
         );
    $("body").keydown(function(e){osc.stop()});
    pitchElem.innerHTML = audioContext.sampleRate;
}



function playNotes(noteArray)
{

for(var i = 0; i < noteArray.length; i++)
    {
    var pitch = typeof(noteArray[i]) == "string" ? noteToPitch[noteArray[i]] : noteArray[i];
    playTone(pitch, i * .5, .5)
    }
}

var osc;

function playTone(frequency, start, duration)
{
var realCoeffs = new Float32Array([0,0,0,0]); // No DC offset or cosine fundamental freq
var imagCoeffs = new Float32Array([0,1,0,.3]); // sine of amplitude 1 at fundamental freq (First imaginary coeff is ignored)
var wave = audioContext.createPeriodicWave(realCoeffs, imagCoeffs);
osc = audioContext.createOscillator();
osc.setPeriodicWave(wave);
osc.frequency.value = frequency;
osc.connect(audioContext.destination);
osc.start(audioContext.currentTime + start);
osc.stop(audioContext.currentTime + start + duration);
}


function getUserMedia(dictionary, callback) {
    try {
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, function(){alert('Stream generation failed.');});
    } catch (e) {
        alert('getUserMedia threw exception :' + e);
    }
}

function gotStream(stream) {
    // Create an AudioNode from the stream.
    mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    mediaStreamSource.connect( analyser );
    updatePitch();
}

var rafID = null;
var tracks = null;
var buflen = 1024;
var buf = new Float32Array( buflen );

var noteStrings = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
var noteToPitch = {"C":523.25, "Db":554.37, "D":587.33, "Eb":622.25, "E":659.25, "F":698.46, "Gb":739.99, "G":783.99, "Ab":830.61, "A":880.00, "Bb":932.33, "B":987.77};
var noteStringsToIndex = {};
for(var i = 0; i < noteStrings.length; i++)
    {
    noteStringsToIndex[noteStrings[i]] = i;
    }

function noteFromPitch( frequency ) {
	var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
	return Math.round( noteNum ) + 57;
}

function frequencyFromNoteNumber( note ) {
	return 440 * Math.pow(2,(note-57)/12);
}

function centsOffFromPitch( frequency, note ) {
	return Math.floor( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
}

function noteStringToNoteNumber(noteString)
{
if(noteString.match(/([A-G]b?)(\d)/))
    {
    var index = RegExp.$1;
    index = noteStringsToIndex[RegExp.$1];
    var octave = RegExp.$1;
    return (octave * 12) + index
    }
}


function autoNCCF(buf, offset, MAX_SAMPLES, sumOfSquares)
    {
    var correlation = 0;
    for (var i=0; i<MAX_SAMPLES; i++) {
	    correlation += (buf[i])*(buf[i+offset]);
    }
    return correlation/sumOfSquares;
    }

function diffCorrelation(buf, offset, MAX_SAMPLES, sumOfSquares)
    { 
	var correlation = 0;
	for (var i=0; i<MAX_SAMPLES; i++) {
		correlation += Math.abs((buf[i])-(buf[i+offset]));
	}
	return 1 - (correlation/MAX_SAMPLES);
    }

function autoCorrelate( buf, sampleRate ) {
	var SIZE = buf.length;
	var MAX_SAMPLES = Math.floor(SIZE/2);
	var best_offset = -1;
	var best_correlation = 0;
	var foundGoodCorrelation = false;
	var correlations = new Array(MAX_SAMPLES);

	var sumOfSquares = 0;
	for (var i=0;i<MAX_SAMPLES;i++) {
		var val = buf[i];
		sumOfSquares += val*val;
	}
	var rms = Math.sqrt(sumOfSquares/MAX_SAMPLES);
	if (rms<0.05) // not enough signal
        {
        if((new Date()).getTime() - waitForPause > millisecondsPauseThreshold)
            {
            waitForPause = 0;
            }
		return -2;
        }
    if(waitForPause)
        {
        waitForPause = (new Date()).getTime();
        }

	var lastCorrelation=1;
	for (var offset = minOffset; offset < maxOffset; offset++) {
        correlation = diffCorrelation(buf, offset, MAX_SAMPLES, sumOfSquares);
		correlations[offset] = correlation;
		if ((correlation > 0.96) && (correlation > lastCorrelation)) {
			foundGoodCorrelation = true;
			if (correlation > best_correlation) {
				best_correlation = correlation;
				best_offset = offset;
			}
		} else if (foundGoodCorrelation) {
            
			return sampleRate/best_offset;
		}
		lastCorrelation = correlation;
	}
	if (best_correlation > 0.96) {
		// console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
        
		return sampleRate/best_offset;
	}
    
	return -1;
//	var best_frequency = sampleRate/best_offset;
}

var prevNotes = [0, 0, 0];
var noteString = "C/4";
var noteLetter = "C";
var noteMatch = false;

function updatePitch( time ) {
	var cycles = new Array;
	analyser.getFloatTimeDomainData( buf );
	//var ac = autoCorrelate( buf, audioContext.sampleRate );
    var ac = autoCorrelate( buf, audioContext.sampleRate );
	if (ac <= -1)
        {
 		detectorElem.className = "vague";
	 	pitchElem.innerHTML = "--";
		noteElem.innerHTML = "-";
		detuneElem.className = "";
		detuneAmount.innerHTML = "--";
        correlationDiv.innerHTML = ac;
 	    }
    else
        {	 	
	 	pitch = ac;
	 	pitchElem.innerHTML = Math.round( pitch ) ;
	 	var note =  noteFromPitch( pitch );
        noteMatch = true;
        for(var i = 0; i < prevNotes.length; i++)
            {
            if(prevNotes[i] != note)
                {
                noteMatch = false;
                break;
                }
            }
        if(noteMatch)
            {            
            detectorElem.className = "confident";
            noteLetter = noteStrings[note%12];
            noteString = noteLetter + "/" + Math.floor(note/12);
            if(playedNoteString == noteString)
                {
                window.setTimeout(function(){
                if(osc && osc.stop)
                    {
                    osc.stop();
                    }
                playNotes([pitch, pitch * 1.25, pitch * 1.5]);
                playedNoteString = undefined;
                noteNumber = undefined;    
                    } , 3000);
                
                }               
		    noteElem.innerHTML = noteString;
		    var detune = centsOffFromPitch( pitch, note );
		    if (detune == 0 )
                {
			    detuneElem.className = "";
			    detuneAmount.innerHTML = "--";
		        }
            else 
                {
			    if (detune < 0)
				    detuneElem.className = "flat";
			    else
				    detuneElem.className = "sharp";
			    detuneAmount.innerHTML = Math.abs( detune  );
		        }
            }
        prevNotes.shift();
        prevNotes.push(note);
	    }
	if(noteMatch && displayStaff)
        {
        waveCanvas.clearRect(0,0,512,256);
        var renderer = new Vex.Flow.Renderer(canvas, Vex.Flow.Renderer.Backends.CANVAS);
        var ctx = renderer.getContext();
        var stave = new Vex.Flow.Stave(10, 0, 500);
        stave.addClef("treble").setContext(ctx).draw();
        var stavNote = new Vex.Flow.StaveNote({ keys: [noteString.toLowerCase()], duration: "q" });
        if(noteString.match(/^[a-g]b/i))
            {
            stavNote.addAccidental(0, new Vex.Flow.Accidental("b"));
            }
        var notes = [stavNote];

        // Create a voice in 4/4
        var voice = new Vex.Flow.Voice({
            num_beats: 1,
            beat_value: 4,
            resolution: Vex.Flow.RESOLUTION
        });

        // Add notes to voice
        voice.addTickables(notes);

        // Format and justify the notes to 500 pixels
        var formatter = new Vex.Flow.Formatter().
          joinVoices([voice]).format([voice], 500);

        // Render voice
        voice.draw(ctx, stave);
        }
    else if(noteMatch && displayWaveform)
        {
        waveCanvas.clearRect(0,0,512,256);
        // This draws the current waveform, useful for debugging		
		waveCanvas.strokeStyle = "red";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,0);
		waveCanvas.lineTo(0,256);
		waveCanvas.moveTo(128,0);
		waveCanvas.lineTo(128,256);
		waveCanvas.moveTo(256,0);
		waveCanvas.lineTo(256,256);
		waveCanvas.moveTo(384,0);
		waveCanvas.lineTo(384,256);
		waveCanvas.moveTo(512,0);
		waveCanvas.lineTo(512,256);
		waveCanvas.stroke();
		waveCanvas.strokeStyle = "black";
		waveCanvas.beginPath();
		waveCanvas.moveTo(0,buf[0]);
		for (var i=1;i<512;i++)
            {
			waveCanvas.lineTo(i,128+(buf[i]*128));
		    }
		waveCanvas.stroke();
        }
    else if(noteMatch)
        {
        $("#chordtable td").css({backgroundColor:"#FFFFFF"});
        $("#chordtable td[good]").css({backgroundColor:"lightgreen"});
        $("#chordtable td[note=" +noteLetter+"][good]").css({backgroundColor:"green"});
        $("#chordtable td[note=" +noteLetter+"][good!=1]").css({backgroundColor:"red"});
        }
 
	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = window.webkitRequestAnimationFrame;
	rafID = window.requestAnimationFrame( updatePitch );
}