"use client";

import { LoadingIcon } from "@/components/LoadingIcon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkStatus,
  generate,
  generate_img,
  generate_img2,
  generate_img_with_controlnet,
  generate_img_with_controlnet2,
  generate_repose_img,
  getUploadUrl,
} from "@/server/generate";
import { VscGithubAlt } from "react-icons/vsc";
import { FaDiscord } from "react-icons/fa";
import { useEffect, useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageGenerationResult } from "@/components/ImageGenerationResult";
import { ImageGenerationResult_repose } from "@/components/ImageGenerationResult_repose";
import { WebsocketDemo } from "@/components/WebsocketDemo";
import { WebsocketDemo2 } from "@/components/WebsocketDemo2";
import { cn } from "@/lib/utils";
import { WebsocketDemo3 } from "@/components/WebsocketDemo3";
import { parseAsInteger, parseAsIsoDateTime, useQueryState } from "next-usequerystate";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Page() {
  const [seletedTab, setSelectedTab] = useQueryState("demo", {
    defaultValue: "txt2img",
  });

  return (
    <main className="flex min-h-screen flex-col items-center justify-between mt-2 ">
      <Tabs value={seletedTab} onValueChange={setSelectedTab} className={cn("w-full flex flex-col items-center", (seletedTab == "ws2" || seletedTab == "ws3") ? " " : "max-w-[600px]")}>
        <TabsList >
          {/* <TabsTrigger value="ws">Realtime</TabsTrigger>
          <TabsTrigger value="ws2">Realtime 2</TabsTrigger>
          <TabsTrigger value="ws3">Screen</TabsTrigger> */}
          <TabsTrigger value="txt2img">txt2img: Character Sheet</TabsTrigger>
          <TabsTrigger value="img2img">img2img: Style Transfer</TabsTrigger>
          <TabsTrigger value="reposerimg">Reposer: Pose Transfer</TabsTrigger>
          <TabsTrigger value="controlpose">Controlpose: Pose2Image</TabsTrigger>
        </TabsList>
        {/* <TabsContent value="ws">
          <WebsocketDemo />
        </TabsContent>
        <TabsContent value="ws2">
          <WebsocketDemo2 />
        </TabsContent>
        <TabsContent value="ws3">
          <WebsocketDemo3 />
        </TabsContent> */}
        <TabsContent value="txt2img">
          <Txt2img />
        </TabsContent>
        <TabsContent value="img2img">
          <Img2img />
        </TabsContent>
        <TabsContent value="reposerimg">
          <ReposeIMG />
        </TabsContent>
        <TabsContent value="controlpose">
          <OpenposeToImage />
        </TabsContent>
      </Tabs>

      <div className="fixed bottom-4 flex gap-2">
        <Button asChild variant={"outline"}>
          <a href="https://github.com/tutnyal" target="_blank" className="plausible-event-name=Button+GitHub flex gap-2 items-center">GitHub <VscGithubAlt /></a>
        </Button>
        <Button asChild variant={"outline"}>
          <a href="https://discord.gg/qtHUaVNRVM" target="_blank" className="plausible-event-name=Button+Discord flex gap-2 items-center">Discord <FaDiscord /></a>
        </Button>
      </div>
    </main>
  );
}

function Txt2img() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [runIds, setRunIds] = useState<string[]>([]);

  return (
    <Card className="w-full max-w-[600px]">
      <CardHeader>
        ainime  - Vector Line Art Tool
        <div className="text-xs text-foreground opacity-50">
          Lora -{" "}
          <a href="https://civitai.com/models/256144/stick-line-vector-illustration">
            stick-line-vector-illustration
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid w-full items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();

            if (loading) return;
            setLoading(true);

            const promises = Array(4).fill(null).map(() => {
              return generate(prompt)
                .then((res) => {
                  if (res) {
                    setRunIds((ids) => [...ids, res.run_id]);
                  }
                  return res;
                })
                .catch((error) => {
                  console.error(error);
                });
            });

            Promise.all(promises).finally(() => {
              setLoading(false);
            });
          }}
        >
          <Label htmlFor="picture">Enter text prompt to generate image</Label>
          <Input
            id="picture"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button type="submit" className="flex gap-2" disabled={loading}>
            Generate {loading && <LoadingIcon />}
          </Button>

          <div className="grid grid-cols-2 gap-4">
            {runIds.map((runId, index) => (
              <ImageGenerationResult key={index} runId={runId} />
            ))}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

async function uploadFile(uploadUrl: string, file: File): Promise<Response> {
  return fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file.type,
      "x-amz-acl": "public-read",
      "Content-Length": file.size.toString(),
    },
  });
}

function Img2img() {
  const [prompt, setPrompt] = useState<File>();
  const [prompt2, setPrompt2] = useState<File>();
  const [txtprompt, txtsetPrompt] = useState("");
  const [txtprompt2, txtsetPrompt2] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState<string>();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setPrompt(e.target.files[0]);
  };
  const handleFileChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setPrompt2(e.target.files[0]);
  };

  // Polling in frontend to check for the
  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(() => {
      checkStatus(runId).then((res) => {
        if (res) setStatus(res.status);
        if (res && res.status === "success") {
          console.log(res.outputs[0]?.data);
          setImage(res.outputs[0]?.data?.images?.[0].url ?? "");
          setLoading(false);
          clearInterval(interval);
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [runId]);

  return (
    <Card className="w-full max-w-[600px]">
      <CardHeader>ainime - Transfer style from one image to the other </CardHeader>
      <CardContent>
        <form
          className="grid w-full items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (loading) return;
            if (!prompt) return;

            setImage("");
            setLoading(true);

            setStatus("getting url for upload");

            console.log(prompt?.type, prompt?.size);

            getUploadUrl(prompt?.type, prompt?.size).then((res) => {
              if (!res) return;

              setStatus("uploading input");

              console.log(res);
              // const uploadOne = await getUploadUrl(prompt.type, prompt.size);
              // const uploadTwo = await getUploadUrl(prompt2.type, prompt2.size);

              fetch(res.upload_url, {
                method: "PUT",
                body: prompt,
                headers: {
                  "Content-Type": prompt.type,
                  "x-amz-acl": "public-read",
                  "Content-Length": prompt.size.toString(),
                },
              }).then((_res) => {
                if (_res.ok) {
                  setStatus("uploaded input");

                  setLoading(true);
                  generate_img2(txtprompt, txtprompt2, res.download_url).then((res) => {
                    console.log(res);
                    if (!res) {
                      setStatus("error");
                      setLoading(false);
                      return;
                    }
                    setRunId(res.run_id);
                  });
                  setStatus("preparing");
                }
              });
            });
          }}
        >
          <Label htmlFor="picture3">Positive Text Prompt</Label>
          <Input
            id="picture3"
            type="text"
            value={txtprompt}
            onChange={(e) => txtsetPrompt(e.target.value)}
          />
          <Label htmlFor="picture2">Negative Text Prompt</Label>
          <Input
            id="picture2"
            type="text"
            value={txtprompt2}
            onChange={(e) => txtsetPrompt2(e.target.value)}
          />
          <Label htmlFor="picture">Image prompt</Label>
          <Input id="picture" type="file" onChange={handleFileChange} />
          {/* <Label htmlFor="picture2">Image prompt 2</Label>
          <Input id="picture2" type="file" onChange={handleFileChange2} /> */}

          <Button type="submit" className="flex gap-2" disabled={loading}>
            Generate {loading && <LoadingIcon />}
          </Button>

          {runId && <ImageGenerationResult key={runId} runId={runId} className="aspect-square" />}
        </form>
      </CardContent>
    </Card>
  );
}

function ReposeIMG() {
  // const [prompt, setPrompt] = useState<File>();
  const [prompt, setPrompt] = useState<File | null>(null);
  const [prompt2, setPrompt2] = useState<File | null>(null);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState<string>();
  const [faceFile, setFaceFile] = useState(null);
  const [styleFile, setStyleFile] = useState(null);
  const [positivePrompt, setPositivePrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('nfsw, bad quality image');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setPrompt(e.target.files[0]);

  };

  const handleFileChange2 = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setPrompt2(e.target.files[0]);
  };


  // Polling in frontend to check for the
  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(() => {
      checkStatus(runId).then((res) => {
        if (res) setStatus(res.status);
        if (res && res.status === "success") {
          console.log(res.outputs[0]?.data);
          setImage(res.outputs[0]?.data?.images?.[0].url ?? "");
          setLoading(false);
          clearInterval(interval);
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [runId]);

  const handleUploads = async (prompt: File, prompt2: File) => {
    if (!prompt || !prompt2) {
      console.log("Both files need to be selected.");
      return;
    }
    setStatus("getting url for upload");


    try {

      // Get upload URLs for both files
      const uploadOne = await getUploadUrl(prompt.type, prompt.size);
      const uploadTwo = await getUploadUrl(prompt2.type, prompt2.size);
      setImage("");
      setStatus("uploading input images");
      // Handle potential nulls from getUploadUrl
      if (!uploadOne || !uploadTwo) {
        console.error("Failed to get one or both upload URLs.");
        setLoading(false);
        return; // Stop the process if URLs can't be obtained

      }

      console.log(prompt?.type, prompt?.size);

      // Upload both files
      const uploadResults = await Promise.all([
        uploadFile(uploadOne.upload_url, prompt),
        uploadFile(uploadTwo.upload_url, prompt2)
      ]);
      console.log(uploadResults);
      if (!uploadResults) return;


      // Check both uploads were successful
      if (uploadResults.every(res => res.ok)) {
        console.log("Both files uploaded successfully");
        // Generate image or any other action that needs both URLs
        await generate_repose_img(positivePrompt, negativePrompt, uploadOne.download_url, uploadTwo.download_url, uploadOne.download_url).then((res) => {
          console.log(res);
          if (!res) {
            setStatus("error");
            setLoading(false);
            return;
          }
          setRunId(res.run_id);
        });;
        setStatus("uploaded input: Success!!");
        // setRunId(res.run_id);
      } else {
        console.log("Failed to upload one or both files");
        setStatus("Failed to upload one or both files :(");
      }
    } catch (error) {
      console.error("Upload or generation error:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevent the default form submission
    setLoading(true);
    if (prompt && prompt2) {
      // Use the files for whatever needs to be done
      await handleUploads(prompt, prompt2); // Adjust handleUploads to accept files as arguments
    } else {
      alert("Please select both files before submitting.");
    }
  };



  return (

    <Card className="w-full">
      <CardHeader>ainime  - Scribble to Anime Girl - transfer the style of any image</CardHeader>
      <CardContent>
        <form
        >
          <Label htmlFor="picture3">Positive txt prompt</Label>
          <Input
            id="picture3"
            type="text"
            value={positivePrompt}
            onChange={(e) => setPositivePrompt(e.target.value)}
          />
          <Label htmlFor="picture4">Negative txt prompt</Label>
          <Input
            id="picture4"
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
          />
          <Label htmlFor="picture">Image prompt</Label>
          <Input id="picture" type="file" onChange={handleFileChange} />

          <Label htmlFor="picture2">Image prompt 2</Label>
          <Input id="picture2" type="file" onChange={handleFileChange2} />

          <Button onClick={handleSubmit} type="submit" className="flex gap-2" disabled={loading}>
            Generate {loading && <LoadingIcon />}
          </Button>

          {runId && <ImageGenerationResult_repose key={runId} runId={runId} className="aspect-square" />}
        </form>

      </CardContent>
    </Card>

  );
}

const poses = {
  arms_on_hips: {
    url: "https://pub-6230db03dc3a4861a9c3e55145ceda44.r2.dev/openpose-pose%20(1).png",
    name: "Arms on Hips",
  },
  waving: {
    url: "https://pub-6230db03dc3a4861a9c3e55145ceda44.r2.dev/openpose-pose%20(2).png",
    name: "Waving",
  },
  legs_together_sideways: {
    url: "https://pub-6230db03dc3a4861a9c3e55145ceda44.r2.dev/openpose-pose%20(3).png",
    name: "Legs together, body at an angle",
  },
  excited_jump: {
    url: "https://pub-6230db03dc3a4861a9c3e55145ceda44.r2.dev/openpose-pose%20(4).png",
    name: "excited jump",
  },
  pointing_to_the_stars: {
    url: "https://pub-6230db03dc3a4861a9c3e55145ceda44.r2.dev/openpose-pose%20(5).png",
    name: "Pointing to the stars",
  },
  Real_img_hand_hip: {
    url: "https://storage.comfydeploy.com/inputs/img_wEj1SX3xTv9XMVfv.jpeg",
    name: "Real_img_hand_hip",
  },

};

function OpenposeToImage() {
  const [prompt, setPrompt] = useState("");
  const [poseImageUrl, setPoseImageUrl] = useState(
    "https://pub-6230db03dc3a4861a9c3e55145ceda44.r2.dev/openpose-pose%20(1).png",
  );
  const [txtprompt, txtsetPrompt] = useState("");
  const [poseLoading, setPoseLoading] = useState(false);
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [runId, setRunId] = useState("");
  const [status, setStatus] = useState<string>();

  const handleSelectChange = (value: keyof typeof poses) => {
    setPoseImageUrl(poses[value].url); // Update image based on selection
  };

  // Polling in frontend to check for the
  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(() => {
      checkStatus(runId).then((res) => {
        if (res) setStatus(res.status);
        if (res && res.status === "success") {
          console.log(res.outputs[0]?.data);
          setImage(res.outputs[0]?.data?.images?.[0].url ?? "");
          setLoading(false);
          clearInterval(interval);
        }
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [runId]);

  return (
    <Card className="w-full max-w-[600px]">
      <CardHeader>
        ainime - Pose Creator Tool
        <div className="text-xs text-foreground opacity-50">
          OpenPose -{" "}
          <a href="https://civitai.com/models/13647/super-pose-book-vol1-controlnet">
            pose book
          </a>
        </div>
      </CardHeader>
      <CardContent>
        <form
          className="grid w-full items-center gap-1.5"
          onSubmit={(e) => {
            if (loading) return;

            e.preventDefault();
            setLoading(true);
            generate_img_with_controlnet2(txtprompt, poseImageUrl, prompt).then((res) => {
              console.log("here", res);
              if (!res) {
                setStatus("error");
                setLoading(false);
                return;
              }
              setRunId(res.run_id);
            });
            setStatus("preparing");
          }}
        >
          <Select
            defaultValue={"Arms on Hips"}
            onValueChange={(value) => {
              handleSelectChange(value as keyof typeof poses);
              setPoseLoading(true); // Start loading when a new pose is selected
            }}
          >
            <Label htmlFor="picture">Pose</Label>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select a Pose" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Poses</SelectLabel>
                {Object.entries(poses).map(([poseName, attr]) => (
                  <SelectItem key={poseName} value={poseName}>
                    {attr.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Label htmlFor="picture3">txt prompt</Label>
          <Input
            id="picture3"
            type="text"
            value={txtprompt}
            onChange={(e) => txtsetPrompt(e.target.value)}
          />
          <Label htmlFor="picture">Image prompt</Label>
          <Input
            id="picture"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button type="submit" className="flex gap-2" disabled={loading}>
            Generate {loading && <LoadingIcon />}
          </Button>

          <div className="grid grid-cols-2 gap-4">
            <div className="w-full rounded-lg relative">
              {/* Pose Image */}
              {poseLoading && (
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                  <LoadingIcon />
                </div>
              )}
              {poseImageUrl && (
                <img
                  className="w-full h-full object-contain"
                  src={poseImageUrl}
                  alt="Selected pose"
                  onLoad={() => setPoseLoading(false)}
                ></img>
              )}
            </div>
            {/* <Separator
              orientation="vertical"
              className="border-gray-200"
              decorative
            /> */}
            <div className="w-full h-full">
              {runId && <ImageGenerationResult key={runId} runId={runId} className="aspect-[768/1152]" />}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
