import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { ChimneyTownDAO, ChimneyTownDAO__factory } from "../types";
import {
  ERC721_INTERFACE_ID,
  ERC721_METADATA_INTERFACE_ID,
} from "./interfaceIdList";
import { MerkleTree } from "merkletreejs";
import keccak256 = require("keccak256");

describe("ChimneyTownDAO", () => {
  let owner: Signer,
    alice: Signer,
    bob: Signer,
    carol: Signer,
    dan: Signer,
    eve: Signer,
    primaryRecipient: Signer;
  let nft: ChimneyTownDAO;
  let ChimneyTown: ChimneyTownDAO__factory;

  let elements, merkleTree: MerkleTree, root: string;

  beforeEach(async () => {
    ChimneyTown = (await ethers.getContractFactory(
      "ChimneyTownDAO"
    )) as ChimneyTownDAO__factory;

    [owner, alice, bob, carol, dan, eve, primaryRecipient] =
      await ethers.getSigners();

    nft = (await ChimneyTown.deploy(
      "https://example.com/image"
    )) as ChimneyTownDAO;

    elements = [
      await alice.getAddress(),
      await bob.getAddress(),
      await carol.getAddress(),
    ];
    merkleTree = new MerkleTree(elements, keccak256, {
      hashLeaves: true,
      sortPairs: true,
    });
    root = merkleTree.getHexRoot();
  });

  describe("constructor", () => {
    it("owner is deployer", async () => {
      expect(await nft.owner()).to.equal(await owner.getAddress());
    });
  });

  it("name", async () => {
    expect(await nft.name()).to.equal("CHIMNEY TOWN DAO");
  });

  it("symbol", async () => {
    expect(await nft.symbol()).to.equal("CTD");
  });

  describe("nextPublicId", () => {
    it("returns id", async () => {
      expect((await nft.nextPublicId()).toNumber()).to.equal(0);
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      expect((await nft.nextPublicId()).toNumber()).to.equal(1);
      await nft.mintReserve(1, await alice.getAddress());
      expect((await nft.nextPublicId()).toNumber()).to.equal(1);
    });
  });

  describe("nextReserveId", () => {
    it("returns id", async () => {
      expect((await nft.nextReserveId()).toNumber()).to.equal(9900);
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      expect((await nft.nextReserveId()).toNumber()).to.equal(9900);
      await nft.mintReserve(1, await alice.getAddress());
      expect((await nft.nextReserveId()).toNumber()).to.equal(9901);
    });
  });

  describe("price", () => {
    it("returns zero if not set", async () => {
      expect(ethers.utils.formatEther(await nft.priceInWei())).to.equal("0.0");
    });

    it("returns price", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      expect(ethers.utils.formatEther(await nft.priceInWei())).to.equal("0.1");
    });

    it("can update", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.2"));
      expect(ethers.utils.formatEther(await nft.priceInWei())).to.equal("0.2");
    });
  });

  describe("isOnSale", () => {
    it("default is false", async () => {
      expect(await nft.isOnSale()).to.be.false;
    });

    it("is on sale", async () => {
      expect(await nft.isOnSale()).to.be.false;
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      expect(await nft.isOnSale()).to.be.true;
    });

    it("can stop", async () => {
      expect(await nft.isOnSale()).to.be.false;
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.setSaleStatus(false);
      expect(await nft.isOnSale()).to.be.false;
    });
  });

  describe("merkleRoot", () => {
    it("returns empty bytes if not set yet", async () => {
      expect(await nft.merkleRoot()).to.equal(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );
    });

    it("returns bytes if its set", async () => {
      await nft.setMerkleRoot(merkleTree.getHexRoot());
      expect(await nft.merkleRoot()).to.equal(merkleTree.getHexRoot());
    });

    it("can update root", async () => {
      await nft.setMerkleRoot(merkleTree.getHexRoot());
      expect(await nft.merkleRoot()).to.equal(merkleTree.getHexRoot());

      const newMerkleTree = new MerkleTree(
        [await alice.getAddress(), await bob.getAddress()],
        keccak256,
        {
          hashLeaves: true,
          sortPairs: true,
        }
      );
      await nft.setMerkleRoot(newMerkleTree.getHexRoot());
      expect(await nft.merkleRoot()).to.equal(newMerkleTree.getHexRoot());
    });
  });

  describe("isClaimed", () => {
    it("returns true after claim", async () => {
      expect(await nft.isClaimed(await alice.getAddress())).to.be.false;
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(proof);

      expect(await nft.isClaimed(await alice.getAddress())).to.be.true;
    });

    it("returns false if minted but not claimed", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.connect(alice).mint({ value: ethers.utils.parseEther("0.1") });

      expect(await nft.isClaimed(await alice.getAddress())).to.be.false;
    });
  });

  describe("prepareMetadataJSON", () => {
    it("returns parsable JSON", async () => {
      JSON.parse(await nft.prepareMetadataJSON(0));
      await nft.updateAnimationURL("https://example.com/animation");
      JSON.parse(await nft.prepareMetadataJSON(1));
      await nft.updateExternalURL("https://example.com/external");
    });

    it("number of name is dynamic", async () => {
      expect(JSON.parse(await nft.prepareMetadataJSON(0)).name).to.equal(
        "CHIMNEY TOWN DAO #0"
      );
      expect(JSON.parse(await nft.prepareMetadataJSON(1)).name).to.equal(
        "CHIMNEY TOWN DAO #1"
      );
    });

    it("contains image", async () => {
      expect(JSON.parse(await nft.prepareMetadataJSON(0)).image).to.equal(
        "https://example.com/image"
      );
      await nft.updateImageURL("https://example.com/updatedimage");
      expect(JSON.parse(await nft.prepareMetadataJSON(0)).image).to.equal(
        "https://example.com/updatedimage"
      );
    });

    it("contains empty description", async () => {
      expect(JSON.parse(await nft.prepareMetadataJSON(0)).description).to.equal(
        ""
      );
    });

    it("parsable if animation and external are set", async () => {
      await nft.updateAnimationURL("https://example.com/animation");
      await nft.updateExternalURL("https://example.com/external");
      JSON.parse(await nft.prepareMetadataJSON(0));
    });

    it("include animation url is its set", async () => {
      await nft.updateAnimationURL("https://example.com/animation");
      expect(
        JSON.parse(await nft.prepareMetadataJSON(0)).animation_url
      ).to.equal("https://example.com/animation");
    });

    it("does not include animation url is its not set", async () => {
      expect(
        JSON.parse(await nft.prepareMetadataJSON(0)).hasOwnProperty(
          "animation_url"
        )
      ).to.be.false;
    });

    it("include external url is its set", async () => {
      await nft.updateExternalURL("https://example.com/external");
      expect(
        JSON.parse(await nft.prepareMetadataJSON(0)).external_url
      ).to.equal("https://example.com/external");
    });

    it("does not include external url is its not set", async () => {
      expect(
        JSON.parse(await nft.prepareMetadataJSON(0)).hasOwnProperty(
          "external_url"
        )
      ).to.be.false;
    });
  });

  describe("tokenURI", () => {
    it("return string", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      expect(await nft.tokenURI(0)).to.not.equal("");
    });

    it("reverts if not minted", async () => {
      await expect(nft.tokenURI(0)).to.be.revertedWith(
        "ChimneyTownDAO: URI query for nonexistent token"
      );
    });
  });

  describe("mint", () => {
    it("success", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.connect(alice).mint({ value: ethers.utils.parseEther("0.1") });
      expect(await nft.ownerOf(0)).to.equals(await alice.getAddress());
      await nft.connect(bob).mint({ value: ethers.utils.parseEther("0.1") });
      expect(await nft.ownerOf(1)).to.equals(await bob.getAddress());
    });

    it("reverts if not on sale", async () => {
      await expect(nft.mint()).to.be.revertedWith(
        "ChimneyTownDAO: Not on sale"
      );
    });

    it("reverts if value is invalid", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await expect(
        nft.connect(alice).mint({ value: ethers.utils.parseEther("0.2") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
      await expect(
        nft.connect(alice).mint({ value: ethers.utils.parseEther("0.05") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
    });
  });

  describe("mintBatch", () => {
    it("success", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft
        .connect(alice)
        .mintBatch(2, { value: ethers.utils.parseEther("0.2") });
      expect(
        (await nft.balanceOf(await alice.getAddress())).toNumber()
      ).to.equals(2);
      expect(await nft.ownerOf(0)).to.equals(await alice.getAddress());
      await nft
        .connect(bob)
        .mintBatch(2, { value: ethers.utils.parseEther("0.2") });
      expect(
        (await nft.balanceOf(await bob.getAddress())).toNumber()
      ).to.equals(2);
      expect(await nft.ownerOf(3)).to.equals(await bob.getAddress());
    });

    it("reverts if not on sale", async () => {
      await expect(nft.mintBatch(2)).to.be.revertedWith(
        "ChimneyTownDAO: Not on sale"
      );
    });

    it("reverts if value is invalid", async () => {
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await expect(
        nft
          .connect(alice)
          .mintBatch(2, { value: ethers.utils.parseEther("0.3") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
      await expect(
        nft
          .connect(alice)
          .mintBatch(2, { value: ethers.utils.parseEther("0.1") })
      ).to.be.revertedWith("ChimneyTownDAO: Invalid price");
    });
  });

  describe("claim", () => {
    it("success", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(proof);
      expect(await nft.ownerOf(0)).to.equal(await alice.getAddress());

      await nft
        .connect(bob)
        .claim(merkleTree.getHexProof(keccak256(await bob.getAddress())));
      expect(await nft.ownerOf(1)).to.equal(await bob.getAddress());
    });

    it("with realistic tree", async () => {
      const thousandAddressList = [...Array(1000)].map(
        (_, i) => "0x" + i.toString().padStart(40, "0")
      );
      console.log(thousandAddressList);
      const realisticMerkleTree = new MerkleTree(
        [await alice.getAddress(), ...thousandAddressList],
        keccak256,
        {
          hashLeaves: true,
          sortPairs: true,
        }
      );
      await nft.setMerkleRoot(realisticMerkleTree.getHexRoot());
      await nft
        .connect(alice)
        .claim(
          realisticMerkleTree.getHexProof(keccak256(await alice.getAddress()))
        );
      expect(await nft.ownerOf(0)).to.equal(await alice.getAddress());
    });

    it("can send ethers", async () => {
      const balance1 = await ethers.provider.getBalance(nft.address);
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft
        .connect(alice)
        .claim(proof, { value: ethers.utils.parseEther("0.1") });
      const balance2 = await ethers.provider.getBalance(nft.address);
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.1");
    });

    it("can claim after replacing merkle root", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(proof);
      expect(await nft.ownerOf(0)).to.equal(await alice.getAddress());
      await expect(
        nft
          .connect(dan)
          .claim(merkleTree.getHexProof(keccak256(await dan.getAddress())))
      ).to.be.revertedWith("ChimneyTownDAO: Can not verify");

      const newMerkleTree = new MerkleTree(
        [
          await dan.getAddress(),
          await carol.getAddress(),
          await eve.getAddress(),
          await alice.getAddress(),
          await bob.getAddress(),
        ],
        keccak256,
        {
          hashLeaves: true,
          sortPairs: true,
        }
      );
      await nft.setMerkleRoot(newMerkleTree.getHexRoot());
      await nft
        .connect(dan)
        .claim(newMerkleTree.getHexProof(keccak256(await dan.getAddress())));
    });

    it("reverts if account already claimed", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await alice.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await nft.connect(alice).claim(proof);
      await expect(nft.connect(alice).claim(proof)).to.be.revertedWith(
        "ChimneyTownDAO: Account minted token already"
      );
    });

    it("reverts if invalid proof is given", async () => {
      await nft.setMerkleRoot(root);
      const leaf = keccak256(await bob.getAddress());
      const proof = merkleTree.getHexProof(leaf);
      await expect(nft.connect(alice).claim(proof)).to.be.revertedWith(
        "ChimneyTownDAO: Can not verify"
      );
    });

    it("revert if merkle root is empty", async () => {
      await expect(nft.claim([])).to.be.revertedWith(
        "ChimneyTownDAO: No merkle root"
      );
    });
  });

  describe("updateImageURL", () => {
    it("reverts if metadata is frozen", async () => {
      await nft.freezeMetadata();
      await expect(nft.updateImageURL("should be reverted")).to.be.revertedWith(
        "ChimneyTownDAO: Already frozen"
      );
    });
  });

  describe("mintReserve", () => {
    it("mint reserved token", async () => {
      await nft.mintReserve(10, await alice.getAddress());
      expect(
        (await nft.balanceOf(await alice.getAddress())).toNumber()
      ).to.equal(10);
    });

    it("can mint up to 100", async () => {
      await nft.mintReserve(100, await alice.getAddress());
      expect(
        (await nft.balanceOf(await alice.getAddress())).toNumber()
      ).to.equal(100);
      await expect(
        nft.mintReserve(1, await alice.getAddress())
      ).to.be.revertedWith("ChimneyTownDAO: All reserved tokens are minted");
    });

    it("only owner", async () => {
      await expect(
        nft.connect(alice).mintReserve(1, await alice.getAddress())
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("setSaleStatus", () => {
    it("reverts if price is zero", async () => {
      await expect(nft.setSaleStatus(true)).to.be.revertedWith(
        "ChimneyTownDAO: Price is not set yet"
      );
    });
  });

  describe("withdraw", () => {
    it("send value to recipient", async () => {
      const balance1 = await primaryRecipient.getBalance();
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      await nft.withdraw(
        await primaryRecipient.getAddress(),
        await ethers.provider.getBalance(nft.address)
      );

      const balance2 = await primaryRecipient.getBalance();
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.1");
    });

    it("recipient is dynamic", async () => {
      const balance1 = await alice.getBalance();
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      await nft.withdraw(
        await alice.getAddress(),
        await ethers.provider.getBalance(nft.address)
      );

      const balance2 = await alice.getBalance();
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.1");
    });

    it("amount to withdraw is dynamic", async () => {
      const balance1 = await alice.getBalance();
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      await nft.withdraw(
        await alice.getAddress(),
        ethers.utils.parseEther("0.05")
      );

      const balance2 = await alice.getBalance();
      expect(ethers.utils.formatEther(balance2.sub(balance1))).to.equal("0.05");
    });

    it("reverts if specified amount is greater than balance", async () => {
      await expect(
        nft.withdraw(await alice.getAddress(), ethers.utils.parseEther("0.1"))
      ).to.be.revertedWith("Address: insufficient balance");
      await nft.setPrice(ethers.utils.parseEther("0.1"));
      await nft.setSaleStatus(true);
      await nft.mint({ value: ethers.utils.parseEther("0.1") });
      await expect(
        nft.withdraw(await alice.getAddress(), ethers.utils.parseEther("0.2"))
      ).to.be.revertedWith("Address: insufficient balance");

      await nft.withdraw(
        await alice.getAddress(),
        ethers.utils.parseEther("0.1")
      );
    });
  });

  it("can receive ETH", async () => {
    await owner.sendTransaction({
      to: nft.address,
      value: ethers.utils.parseEther("0.1"),
    });
    expect(
      ethers.utils.formatEther(await ethers.provider.getBalance(nft.address))
    ).to.equal("0.1");
  });

  describe("supportsInterface", () => {
    it("supports ERC721 interface", async () => {
      expect(await nft.supportsInterface(ERC721_INTERFACE_ID)).to.be.true;
    });

    it("supports ERC721Metadata interface", async () => {
      expect(await nft.supportsInterface(ERC721_METADATA_INTERFACE_ID)).to.be
        .true;
    });
  });

  // TODO activate to test
  xit("sold out", async () => {
    await nft.setPrice(ethers.utils.parseEther("0.01"));
    await nft.setSaleStatus(true);
    for (let i = 0; i < 99; i++) {
      console.log("i: ", i);
      await nft
        .connect(alice)
        .mintBatch(100, { value: ethers.utils.parseEther("1") });
    }
    await expect(
      nft.connect(alice).mint({ value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("ChimneyTownDAO: All public tokens are minted");
    await expect(
      nft.connect(alice).mintBatch(100, { value: ethers.utils.parseEther("1") })
    ).to.be.revertedWith("ChimneyTownDAO: All public tokens are minted");
    await nft.setMerkleRoot(root);
    const leaf = keccak256(await alice.getAddress());
    const proof = merkleTree.getHexProof(leaf);
    await expect(nft.connect(alice).claim(proof)).to.be.revertedWith(
      "ChimneyTownDAO: All public tokens are minted"
    );
    await nft.mintReserve(100, await alice.getAddress());
    await expect(
      nft.mintReserve(1, await alice.getAddress())
    ).to.be.revertedWith("ChimneyTownDAO: All reserved tokens are minted");
  });
});
